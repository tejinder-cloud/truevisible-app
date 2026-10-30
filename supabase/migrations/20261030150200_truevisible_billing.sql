-- TrueVisible Day 1 · shared billing tables + signup bootstrap + plan limits (SPEC §2, §9, §11)

create table public.subscriptions (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        text not null references public.tenants(id) on delete cascade,   -- who pays (agency for white-label brands)
  brand_id         uuid references public.brands(id) on delete set null,            -- line item for one brand (seat / managed AEO)
  product          text not null default 'truevisible' check (product in ('truevisible','truelead')),
  plan             text not null check (plan in ('internal','trial','truevisible','managed_aeo','agency','agency_seat','agency_managed_aeo')),  -- internal = TGL's own tenant, never invoiced
  status           text not null default 'trialing' check (status in ('trialing','active','past_due','cancelled','suspended','expired')),
  price_minor      bigint not null default 0 check (price_minor >= 0),   -- paise / cents, ex-GST
  currency         text not null default 'INR' check (currency in ('INR','USD')),
  gst_rate         numeric(4,2) not null default 18.00,                  -- 0 for USD export under LUT
  billing_interval text not null default 'month' check (billing_interval in ('month','year')),
  billing_owner    text not null default 'brand' check (billing_owner in ('agency','brand')),
  referral_source  text,
  trial_ends_at    timestamptz,
  current_period_end timestamptz,
  razorpay_subscription_id text unique,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index subscriptions_tenant_idx on public.subscriptions(tenant_id, product, status);
create index subscriptions_brand_idx on public.subscriptions(brand_id);
create trigger subscriptions_updated_at before update on public.subscriptions for each row execute function private.set_updated_at();

create table public.invoices (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           text not null references public.tenants(id) on delete cascade,
  subscription_id     uuid references public.subscriptions(id) on delete set null,
  number              text unique,
  amount_minor        bigint not null check (amount_minor >= 0),   -- ex-GST
  gst_minor           bigint not null default 0 check (gst_minor >= 0),
  currency            text not null default 'INR' check (currency in ('INR','USD')),
  status              text not null default 'draft' check (status in ('draft','issued','paid','void')),
  issued_at           timestamptz,
  paid_at             timestamptz,
  pdf_url             text,
  razorpay_invoice_id text unique,
  created_at          timestamptz not null default now()
);
create index invoices_tenant_idx on public.invoices(tenant_id, issued_at desc);
create index invoices_subscription_idx on public.invoices(subscription_id);

create table public.usage_costs (     -- per brand per day: the margin number (target < ₹600/brand/month). Internal only.
  id          uuid primary key default gen_random_uuid(),
  tenant_id   text not null references public.tenants(id) on delete cascade,
  brand_id    uuid references public.brands(id) on delete set null,
  product     text not null default 'truevisible' check (product in ('truevisible','truelead','tgl_ops')),
  cost_date   date not null,
  category    text not null check (category in ('engine_api','llm','browser','messaging','email','storage','other')),
  engine      text,
  units       numeric,
  amount_inr  numeric(12,4) not null check (amount_inr >= 0),
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index usage_costs_brand_date_idx on public.usage_costs(brand_id, cost_date);
create index usage_costs_tenant_date_idx on public.usage_costs(tenant_id, cost_date);

alter table public.subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.usage_costs enable row level security;
-- Billing is visible only to members of the paying tenant (an agency's clients never see wholesale prices).
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (tenant_id in (select m.tenant_id from public.tenant_members m where m.user_id = (select auth.uid())));
create policy invoices_select on public.invoices for select to authenticated
  using (tenant_id in (select m.tenant_id from public.tenant_members m where m.user_id = (select auth.uid())));
-- usage_costs: no client policy at all → service role only.

-- Tenant zero (client zero = thegrowthlab.co.in) runs on an internal, never-invoiced plan.
insert into public.subscriptions (tenant_id, product, plan, status, price_minor, currency, gst_rate, billing_owner)
values ('tgl', 'truevisible', 'internal', 'active', 0, 'INR', 0, 'brand');

-- ── signup bootstrap: one direct tenant + owner membership + 14-day trial ──
create or replace function public.tv_bootstrap_tenant(p_name text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id  text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select m.tenant_id into v_id from public.tenant_members m where m.user_id = v_uid order by m.created_at limit 1;
  if v_id is not null then return v_id; end if;

  v_id := 't_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  insert into public.tenants (id, name, kind) values (v_id, coalesce(nullif(trim(p_name), ''), 'My workspace'), 'direct');
  insert into public.tenant_members (tenant_id, user_id, role) values (v_id, v_uid, 'owner');
  insert into public.subscriptions (tenant_id, product, plan, status, price_minor, currency, gst_rate, billing_owner, trial_ends_at)
       values (v_id, 'truevisible', 'trial', 'trialing', 0, 'INR', 18.00, 'brand', now() + interval '14 days');
  return v_id;
end $$;
revoke all on function public.tv_bootstrap_tenant(text) from public, anon;
grant execute on function public.tv_bootstrap_tenant(text) to authenticated;

-- ── plan limits enforced in the database (SPEC §2) ──────────────────────
create or replace function private.tv_prompt_limit(p_tenant text) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(max(case
           when s.plan = 'trial' and s.status = 'trialing' and s.trial_ends_at > now() then 10
           when s.plan = 'internal' then 50
           when s.plan in ('truevisible','managed_aeo','agency','agency_seat','agency_managed_aeo') and s.status in ('active','past_due') then 50
         end), 0)
    from public.subscriptions s
   where s.product = 'truevisible'
     and (s.tenant_id = p_tenant
          or s.tenant_id = (select t.parent_tenant_id from public.tenants t where t.id = p_tenant))
$$;

create or replace function private.tv_enforce_prompt_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_limit int; v_count int;
begin
  if new.status <> 'active' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'active' then return new; end if;
  -- service role (engine runners, setup agent) is not limited here
  if (select auth.role()) = 'service_role' then return new; end if;
  v_limit := private.tv_prompt_limit(new.tenant_id);
  select count(*) into v_count from public.prompts p where p.brand_id = new.brand_id and p.status = 'active';
  if v_count >= v_limit then
    raise exception 'prompt limit reached: % active prompts allowed on this plan', v_limit using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger prompts_limit before insert or update of status on public.prompts
  for each row execute function private.tv_enforce_prompt_limit();

-- one brand per direct tenant on trial / TrueVisible plan (agency seats come in v2)
create or replace function private.tv_enforce_brand_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.role()) = 'service_role' then return new; end if;
  if (select t.kind from public.tenants t where t.id = new.tenant_id) = 'direct'
     and exists (select 1 from public.brands b where b.tenant_id = new.tenant_id) then
    raise exception 'this plan includes one brand' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger brands_limit before insert on public.brands
  for each row execute function private.tv_enforce_brand_limit();

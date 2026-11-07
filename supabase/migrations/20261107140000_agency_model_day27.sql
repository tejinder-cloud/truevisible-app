-- Day 27: agency data model v1 (SPEC §9). No agency UI yet (v2); these are the rules the UI and Mission Control use.
-- Agency = TGL's customer; its brands live in agency_client tenants under it; TGL never invoices or emails them.

-- 1. Prices as data, so the company project can change them without code. Seeded from SPEC §9 (decided 23 Oct 2026).
create table if not exists public.price_book (
  key            text primary key,
  inr_minor      bigint check (inr_minor >= 0),
  usd_minor      bigint check (usd_minor >= 0),
  note           text,
  effective_from date not null default current_date,
  updated_at     timestamptz not null default now()
);
alter table public.price_book enable row level security;     -- internal: service role only
insert into public.price_book (key, inr_minor, usd_minor, note) values
  ('agency_base_3_seats', 450000, null, 'Agency plan, 3 brand seats, per month ex-GST (SPEC §9, 23 Oct 2026; confirmed 7 Nov; quoted in conversation, not public)'),
  ('agency_extra_seat',    99900, null, 'Each extra brand seat, per month ex-GST (SPEC §9; confirmed 7 Nov)'),
  ('agency_managed_brand', 699900, null, 'Agency brand on managed AEO, wholesale, per month ex-GST (SPEC §9; confirmed 7 Nov)')
on conflict (key) do nothing;

-- 2. White-label settings: only known keys, safe values (shown on dashboards, reports and emails in v2).
create or replace function private.valid_white_label(w jsonb) returns boolean language sql immutable as $$
  select jsonb_typeof(w) = 'object'
     and not exists (select 1 from jsonb_object_keys(w) k where k not in ('app_name','logo_url','primary_color','accent_color','sender_name','reply_to'))
     and (w->>'logo_url' is null or w->>'logo_url' ~ '^https://[^\s"<>]+$')
     and (w->>'primary_color' is null or w->>'primary_color' ~ '^#[0-9A-Fa-f]{6}$')
     and (w->>'accent_color' is null or w->>'accent_color' ~ '^#[0-9A-Fa-f]{6}$')
     and (w->>'sender_name' is null or length(w->>'sender_name') between 1 and 60)
     and (w->>'app_name' is null or length(w->>'app_name') between 1 and 40)
     and (w->>'reply_to' is null or w->>'reply_to' ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
$$;
alter table public.tenants add constraint tenants_white_label_valid check (private.valid_white_label(white_label));
alter table public.brands add constraint brands_white_label_valid check (private.valid_white_label(white_label));

-- 3. Seats, grace and the 90-day price hold.
alter table public.subscriptions add column if not exists extra_seats int not null default 0 check (extra_seats >= 0),
                                 add column if not exists past_due_since timestamptz;
alter table public.tenants add column if not exists agency_price_until timestamptz,   -- brand that left an agency keeps agency pricing until then
                           add column if not exists left_agency_id text references public.tenants(id) on delete set null;

create or replace function private.track_past_due() returns trigger language plpgsql as $$
begin
  if new.status = 'past_due' and (old.status is distinct from 'past_due') then new.past_due_since := now();
  elsif new.status <> 'past_due' then new.past_due_since := null; end if;
  return new;
end $$;
drop trigger if exists subscriptions_past_due on public.subscriptions;
create trigger subscriptions_past_due before update of status on public.subscriptions for each row execute function private.track_past_due();

-- A brand in an agency_client tenant always carries its agency (kept in step automatically).
create or replace function private.brand_agency() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select case when t.kind = 'agency_client' then t.parent_tenant_id end into new.agency_id from public.tenants t where t.id = new.tenant_id;
  return new;
end $$;
drop trigger if exists brands_agency on public.brands;
create trigger brands_agency before insert or update of tenant_id on public.brands for each row execute function private.brand_agency();

-- 4. Operations (service role: Mission Control / tgl-ops; agency UI in v2).
create or replace function public.svc_agency_seats(p_agency text) returns table (included int, used int) language sql stable security definer set search_path = '' as $$
  select 3 + coalesce((select s.extra_seats from public.subscriptions s where s.tenant_id = p_agency and s.product = 'truevisible' order by s.created_at desc limit 1), 0),
         (select count(*)::int from public.tenants t where t.parent_tenant_id = p_agency and t.kind = 'agency_client');
$$;

create or replace function public.svc_agency_create(p_name text, p_owner uuid, p_country text default 'IN') returns text language plpgsql security definer set search_path = '' as $$
declare v_id text := 'a_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
begin
  insert into public.tenants (id, name, kind, country) values (v_id, p_name, 'agency', coalesce(p_country, 'IN'));
  insert into public.tenant_members (tenant_id, user_id, role) values (v_id, p_owner, 'owner');
  insert into public.subscriptions (tenant_id, product, plan, status, price_minor, currency, gst_rate, billing_owner)
  values (v_id, 'truevisible', 'agency', 'active', (select inr_minor from public.price_book where key = 'agency_base_3_seats'), 'INR', 18.00, 'agency');
  return v_id;
end $$;

create or replace function public.svc_agency_add_client(p_agency text, p_name text) returns text language plpgsql security definer set search_path = '' as $$
declare v_id text; v_inc int; v_used int;
begin
  if not exists (select 1 from public.tenants where id = p_agency and kind = 'agency') then raise exception 'not an agency'; end if;
  select included, used into v_inc, v_used from public.svc_agency_seats(p_agency);
  if v_used >= v_inc then raise exception 'all % seats in use — add a seat first', v_inc; end if;
  v_id := 'c_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  insert into public.tenants (id, name, kind, parent_tenant_id) values (v_id, p_name, 'agency_client', p_agency);
  return v_id;
end $$;

-- Brand leaves its agency: becomes a direct customer, keeps agency pricing for 90 days (SPEC §9 edge rule).
create or replace function public.svc_brand_leave_agency(p_client text) returns void language plpgsql security definer set search_path = '' as $$
declare v_agency text;
begin
  select parent_tenant_id into v_agency from public.tenants where id = p_client and kind = 'agency_client';
  if v_agency is null then raise exception 'not an agency client'; end if;
  update public.tenants set kind = 'direct', parent_tenant_id = null, left_agency_id = v_agency, agency_price_until = now() + interval '90 days', white_label = '{}'::jsonb where id = p_client;
  update public.brands set agency_id = null, white_label = '{}'::jsonb where tenant_id = p_client;
  -- Direct account with no paid plan yet: checks stop, dashboard stays readable with "Upgrade" (agency price held 90 days).
  insert into public.subscriptions (tenant_id, product, plan, status, price_minor, currency, gst_rate, billing_owner, trial_ends_at)
  values (p_client, 'truevisible', 'trial', 'expired', 0, 'INR', 18.00, 'brand', now());
end $$;

-- Agency unpaid for 15 days → suspended (its client brands follow: no checks, dashboards readable).
create or replace function public.svc_agency_grace_check() returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.subscriptions s set status = 'suspended'
   where s.plan in ('agency','agency_seat','agency_managed_aeo') and s.status = 'past_due' and s.past_due_since < now() - interval '15 days';
  get diagnostics n = row_count;
  return n;
end $$;

-- What the agency's one consolidated monthly invoice would be (ex-GST), from the price book.
create or replace view public.v_agency_invoice_preview with (security_invoker = true) as
select a.id as agency_id, a.name,
       seats.included, seats.used, greatest(seats.used - 3, 0) as extra_seats_used,
       (select count(*) from public.tenants c join public.subscriptions cs on cs.tenant_id = c.id
         where c.parent_tenant_id = a.id and cs.plan in ('managed','managed_aeo','agency_managed_aeo') and cs.status = 'active') as managed_brands,
       (select inr_minor from public.price_book where key = 'agency_base_3_seats')
       + greatest(seats.used - 3, 0) * (select inr_minor from public.price_book where key = 'agency_extra_seat')
       + (select count(*) from public.tenants c join public.subscriptions cs on cs.tenant_id = c.id
           where c.parent_tenant_id = a.id and cs.plan in ('managed','managed_aeo','agency_managed_aeo') and cs.status = 'active')
         * (select inr_minor from public.price_book where key = 'agency_managed_brand') as amount_minor_ex_gst
  from public.tenants a cross join lateral public.svc_agency_seats(a.id) seats
 where a.kind = 'agency';
revoke all on public.v_agency_invoice_preview from anon, authenticated;

revoke all on function public.svc_agency_seats(text), public.svc_agency_create(text, uuid, text), public.svc_agency_add_client(text, text),
  public.svc_brand_leave_agency(text), public.svc_agency_grace_check() from public, anon, authenticated;
grant execute on function public.svc_agency_seats(text), public.svc_agency_create(text, uuid, text), public.svc_agency_add_client(text, text),
  public.svc_brand_leave_agency(text), public.svc_agency_grace_check() to service_role;

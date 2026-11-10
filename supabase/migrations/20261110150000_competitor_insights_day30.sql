-- Day 30: competitor intelligence. tgl-ops writes one report per brand per 30 days; customers read their own.
create table if not exists public.competitor_insights (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  brand_id uuid not null,
  period_from date not null,
  period_to date not null,
  answers_total int not null,
  named_total int not null,
  rivals jsonb not null,       -- measured by code: [{name, tracked, answers, winsOverYou, engines, questions[], sites[]}]
  discovered jsonb not null,   -- names AI recommends that aren't tracked, each verified in 2+ answers: [{name, answers}]
  playbooks jsonb not null,    -- [{rival, why[{text, refs}], moves[]}] — refs point into that rival's questions/sites
  cost_usd numeric,
  created_at timestamptz not null default now(),
  foreign key (brand_id, tenant_id) references public.brands(id, tenant_id) on update cascade on delete cascade
);
create index if not exists competitor_insights_brand_idx on public.competitor_insights (brand_id, created_at desc);
alter table public.competitor_insights enable row level security;
drop policy if exists competitor_insights_select on public.competitor_insights;
create policy competitor_insights_select on public.competitor_insights for select to authenticated using (tenant_id in (select private.user_tenant_ids()));
revoke all on public.competitor_insights from anon, authenticated;
grant select (id, tenant_id, brand_id, period_from, period_to, answers_total, named_total, rivals, discovered, playbooks, created_at) on public.competitor_insights to authenticated;

-- Track a rival the report found: only names the latest report verified, at most 10 active competitors.
create or replace function public.tv_track_competitor(p_brand uuid, p_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_tenant text; v_found boolean;
begin
  select b.tenant_id into v_tenant from public.brands b where b.id = p_brand and b.tenant_id in (select private.user_tenant_ids());
  if v_tenant is null then raise exception 'brand not found'; end if;
  select exists (select 1 from public.competitor_insights ci, jsonb_array_elements(ci.discovered) d
                  where ci.id = (select id from public.competitor_insights where brand_id = p_brand order by created_at desc limit 1)
                    and lower(d->>'name') = lower(p_name)) into v_found;
  if not v_found then raise exception 'not in the latest competitor report'; end if;
  if (select count(*) from public.competitors where brand_id = p_brand and status = 'active') >= 10 then raise exception 'you already track 10 competitors — remove one in Settings first'; end if;
  insert into public.competitors (tenant_id, brand_id, name, source, status)
  values (v_tenant, p_brand, trim(p_name), 'suggested', 'active')
  on conflict (brand_id, name) do update set status = 'active';
end $$;
revoke all on function public.tv_track_competitor(uuid, text) from public, anon, authenticated;
grant execute on function public.tv_track_competitor(uuid, text) to authenticated;

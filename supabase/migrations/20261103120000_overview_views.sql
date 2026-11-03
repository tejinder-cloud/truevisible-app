-- Dashboard Overview (plan Day 20). security_invoker: each view runs with the caller's RLS, so a customer sees only their tenant.
-- Only completed runs (succeeded / partial) count — failed or abandoned runs never reach a screen.
create or replace view public.v_visibility_daily with (security_invoker = true) as
select a.tenant_id, a.brand_id, r.run_date, r.engine,
       count(*)::int as answers,
       count(*) filter (where a.mentioned)::int as mentioned
  from public.answers a
  join public.runs r on r.id = a.run_id
 where r.status in ('succeeded', 'partial')
 group by a.tenant_id, a.brand_id, r.run_date, r.engine;

create or replace view public.v_citation_domains_daily with (security_invoker = true) as
select c.tenant_id, c.brand_id, r.run_date, c.domain,
       max(c.channel_type) as channel_type,
       coalesce(bool_or(c.brand_mentioned), false) as owned,
       count(*)::int as citations,
       count(distinct c.answer_id)::int as answers
  from public.citations c
  join public.answers a on a.id = c.answer_id
  join public.runs r on r.id = a.run_id
 where r.status in ('succeeded', 'partial')
 group by c.tenant_id, c.brand_id, r.run_date, c.domain;

revoke all on public.v_visibility_daily, public.v_citation_domains_daily from anon;
grant select on public.v_visibility_daily, public.v_citation_domains_daily to authenticated;

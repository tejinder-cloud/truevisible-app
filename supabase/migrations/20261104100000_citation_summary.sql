-- Citations tab (plan Day 21). Aggregated in the database so a week of citations fits one response.
-- security invoker (the default): runs with the caller's RLS, so a customer only ever sees their own tenant's rows.
-- Completed runs only, same rule as the Overview views.
create or replace function public.citation_summary(p_brand uuid, p_from date)
returns table (domain text, channel_type text, owned boolean, answers int, named_you int, without_you int, competitor_not_you int, competitors text[])
language sql stable security invoker set search_path = public as $$
  select c.domain,
         max(c.channel_type),
         coalesce(bool_or(c.brand_mentioned), false),
         count(distinct c.answer_id)::int,
         count(distinct c.answer_id) filter (where a.mentioned)::int,
         count(distinct c.answer_id) filter (where not coalesce(a.mentioned, false))::int,
         count(distinct c.answer_id) filter (where not coalesce(a.mentioned, false) and cardinality(a.competitors_mentioned) > 0)::int,
         coalesce(array_agg(distinct comp) filter (where comp is not null and not coalesce(a.mentioned, false)), '{}')
    from public.citations c
    join public.answers a on a.id = c.answer_id
    join public.runs r on r.id = a.run_id
    left join lateral unnest(a.competitors_mentioned) comp on true
   where c.brand_id = p_brand and r.run_date >= p_from and r.status in ('succeeded', 'partial')
   group by c.domain
$$;

create or replace function public.citation_urls(p_brand uuid, p_from date, p_limit int default 25)
returns table (url text, domain text, channel_type text, answers int, named_you int)
language sql stable security invoker set search_path = public as $$
  select c.url, max(c.domain), max(c.channel_type),
         count(distinct c.answer_id)::int,
         count(distinct c.answer_id) filter (where a.mentioned)::int
    from public.citations c
    join public.answers a on a.id = c.answer_id
    join public.runs r on r.id = a.run_id
   where c.brand_id = p_brand and c.url is not null and r.run_date >= p_from and r.status in ('succeeded', 'partial')
   group by c.url
   order by 4 desc, 1
   limit least(greatest(p_limit, 1), 100)
$$;

revoke all on function public.citation_summary(uuid, date), public.citation_urls(uuid, date, int) from public, anon;
grant execute on function public.citation_summary(uuid, date), public.citation_urls(uuid, date, int) to authenticated;

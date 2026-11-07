-- Day 26 (Architect decision 7 Nov 2026): Track / Managed / Managed Plus; 7-day trial from the first verified run.
alter table public.subscriptions drop constraint subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in
  ('internal','trial','track','managed','managed_plus','truevisible','managed_aeo','agency','agency_seat','agency_managed_aeo'));
alter table public.subscriptions add column if not exists trial_started_at timestamptz;

create or replace function private.tv_prompt_limit(p_tenant text)
 returns integer language sql stable security definer set search_path to '' as $function$
  select coalesce(max(case
           when s.plan = 'trial' and s.status = 'trialing' and (s.trial_ends_at is null or s.trial_ends_at > now()) then 10
           when s.plan = 'internal' then 50
           when s.status in ('active','past_due') and s.plan = 'managed_plus' then 100 + s.extra_prompts
           when s.status in ('active','past_due') and s.plan in ('track','managed','truevisible','managed_aeo','agency','agency_seat','agency_managed_aeo') then 50 + s.extra_prompts
         end), 0)
    from public.subscriptions s
   where s.product = 'truevisible'
     and (s.tenant_id = p_tenant
          or s.tenant_id = (select t.parent_tenant_id from public.tenants t where t.id = p_tenant))
$function$;

create or replace function public.tv_bootstrap_tenant(p_name text default null)
 returns text language plpgsql security definer set search_path to '' as $function$
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
       values (v_id, 'truevisible', 'trial', 'trialing', 0, 'INR', 18.00, 'brand', null);
  return v_id;
end $function$;

-- The trial's day-7 baseline report.
alter table public.reports drop constraint reports_kind_check;
alter table public.reports add constraint reports_kind_check check (kind in ('audit','daily','weekly','monthly','baseline'));

-- Architect decision 4 Nov 2026: paid plans track 25 questions (HubSpot-shaped), extra questions sold in packs.
alter table public.subscriptions add column if not exists extra_prompts int not null default 0 check (extra_prompts >= 0);

create or replace function private.tv_prompt_limit(p_tenant text)
 returns integer language sql stable security definer set search_path to '' as $function$
  select coalesce(max(case
           when s.plan = 'trial' and s.status = 'trialing' and s.trial_ends_at > now() then 10
           when s.plan = 'internal' then 50
           when s.plan in ('truevisible','managed_aeo','agency','agency_seat','agency_managed_aeo') and s.status in ('active','past_due') then 25 + s.extra_prompts
         end), 0)
    from public.subscriptions s
   where s.product = 'truevisible'
     and (s.tenant_id = p_tenant
          or s.tenant_id = (select t.parent_tenant_id from public.tenants t where t.id = p_tenant))
$function$;

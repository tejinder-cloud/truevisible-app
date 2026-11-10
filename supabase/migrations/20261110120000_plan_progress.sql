-- Plan items the team marks done (listings, outreach, Google profile work, measurements). One place for the rule,
-- used from the dashboard (TGL's own account) and from Slack (tgl-ops, any managed client). A done item that changed
-- something is also written to actions, so it shows in the client's "What changed" with its proof link.
create table if not exists public.aeo_plan_progress (
  plan_id uuid not null references public.aeo_plans(id) on delete cascade,
  item_id text not null,
  tenant_id text not null,
  brand_id uuid not null,
  url text check (url is null or url ~ '^https?://'),
  note text check (note is null or length(note) <= 500),
  done_by text not null,
  done_at timestamptz not null default now(),
  action_id uuid,
  primary key (plan_id, item_id)
);
alter table public.aeo_plan_progress enable row level security;
drop policy if exists aeo_plan_progress_select on public.aeo_plan_progress;
create policy aeo_plan_progress_select on public.aeo_plan_progress for select to authenticated using (tenant_id in (select private.user_tenant_ids()));
revoke all on public.aeo_plan_progress from anon, authenticated;
grant select on public.aeo_plan_progress to authenticated;

create or replace function private.plan_item_done(p_plan uuid, p_item text, p_url text, p_note text, p_by text)
returns void language plpgsql security definer set search_path = '' as $$
declare p record; it jsonb; v_path text; v_action uuid;
begin
  select * into p from public.aeo_plans where id = p_plan and status = 'approved';
  if p.id is null then raise exception 'plan not found or not live'; end if;
  select x into it from jsonb_array_elements(p.items) x where x->>'id' = p_item;
  if it is null then raise exception 'item not in this plan'; end if;
  if p_url is not null and p_url !~ '^https?://' then raise exception 'link must start with http:// or https://'; end if;
  if exists (select 1 from public.aeo_plan_progress where plan_id = p_plan and item_id = p_item) then return; end if;
  v_path := case it->>'path' when 'wordpress' then 'wordpress' when 'change_pack' then 'change_pack' when 'team' then null else 'offsite' end;
  if v_path is not null then
    insert into public.actions (tenant_id, brand_id, recommendation_id, path, description, status, performed_by, performed_at, url, detail)
    values (p.tenant_id, p.brand_id, nullif(it->>'recommendation_id', '')::uuid, v_path, it->>'title', 'done', 'The Growth Lab', now(), nullif(trim(p_url), ''),
            jsonb_build_object('plan_id', p_plan, 'plan_item', p_item, 'week', (it->>'week')::int, 'note', nullif(trim(p_note), ''), 'marked_by', p_by))
    returning id into v_action;
  end if;
  insert into public.aeo_plan_progress (plan_id, item_id, tenant_id, brand_id, url, note, done_by, action_id)
  values (p_plan, p_item, p.tenant_id, p.brand_id, nullif(trim(p_url), ''), nullif(trim(p_note), ''), p_by, v_action);
  if it->>'recommendation_id' is not null then
    update public.recommendations set status = 'done' where id = (it->>'recommendation_id')::uuid and status in ('open','diy');
  end if;
end $$;

create or replace function private.plan_item_undo(p_plan uuid, p_item text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_action uuid;
begin
  delete from public.aeo_plan_progress where plan_id = p_plan and item_id = p_item returning action_id into v_action;
  if v_action is not null then delete from public.actions where id = v_action; end if;
end $$;

-- Dashboard: only TGL's own (internal) account marks its own plan; clients don't mark the team's work.
create or replace function private.tv_is_internal(p_tenant text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.subscriptions s where s.tenant_id = p_tenant and s.product = 'truevisible' and s.plan = 'internal');
$$;

create or replace function public.tv_plan_item_done(p_plan uuid, p_item text, p_url text default null, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_tenant text;
begin
  select tenant_id into v_tenant from public.aeo_plans where id = p_plan and tenant_id in (select private.user_tenant_ids());
  if v_tenant is null or not private.tv_is_internal(v_tenant) then raise exception 'not allowed'; end if;
  perform private.plan_item_done(p_plan, p_item, p_url, p_note, coalesce((select email from auth.users where id = auth.uid()), 'dashboard'));
end $$;

create or replace function public.tv_plan_item_undo(p_plan uuid, p_item text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_tenant text;
begin
  select tenant_id into v_tenant from public.aeo_plans where id = p_plan and tenant_id in (select private.user_tenant_ids());
  if v_tenant is null or not private.tv_is_internal(v_tenant) then raise exception 'not allowed'; end if;
  perform private.plan_item_undo(p_plan, p_item);
end $$;

-- Slack (tgl-ops, service role): any client's plan.
create or replace function public.svc_plan_item_done(p_plan uuid, p_item text, p_url text, p_note text, p_by text)
returns void language sql security definer set search_path = '' as $$ select private.plan_item_done(p_plan, p_item, p_url, p_note, p_by); $$;

revoke all on function private.plan_item_done(uuid, text, text, text, text), private.plan_item_undo(uuid, text), private.tv_is_internal(text) from public, anon, authenticated;
revoke all on function public.tv_plan_item_done(uuid, text, text, text), public.tv_plan_item_undo(uuid, text), public.svc_plan_item_done(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.tv_plan_item_done(uuid, text, text, text), public.tv_plan_item_undo(uuid, text) to authenticated;
grant execute on function public.svc_plan_item_done(uuid, text, text, text, text) to service_role;

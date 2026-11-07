-- Day 29: the Implementer drafts approved pages on the customer's WordPress and publishes them on approval.
-- Customers ask through these two functions; tgl-ops (service role) does the work and records every step in actions.

-- Publishing for the customer is managed work: TGL itself and managed plans (incl. agency-managed brands).
create or replace function private.tv_can_publish(p_tenant text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.subscriptions s
   where s.product = 'truevisible'
     and (s.tenant_id = p_tenant or s.tenant_id = (select t.parent_tenant_id from public.tenants t where t.id = p_tenant))
     and (s.plan = 'internal' or (s.plan in ('managed','managed_plus','managed_aeo','agency_managed_aeo') and s.status in ('active','past_due'))));
$$;

create or replace function public.tv_wp_request_draft(p_rec uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r record; v_kind text; v_id uuid;
begin
  select rc.id, rc.tenant_id, rc.brand_id, rc.title, rc.category, rc.asset_refs into r from public.recommendations rc
   where rc.id = p_rec and rc.tenant_id in (select private.user_tenant_ids()) and rc.status in ('open','diy');
  if r.id is null then raise exception 'recommendation not found'; end if;
  if not private.tv_can_publish(r.tenant_id) then raise exception 'publishing is part of managed AEO'; end if;
  if not exists (select 1 from public.integrations i where i.brand_id = r.brand_id and i.provider = 'wordpress' and i.status = 'connected') then
    raise exception 'connect WordPress in Settings first'; end if;
  select a.kind into v_kind from public.assets a where a.id = r.asset_refs[1];
  if v_kind is null or v_kind not in ('page_draft','faq_block') then raise exception 'this change can''t be drafted on WordPress yet — use the change pack'; end if;
  -- One live attempt per recommendation; a failed one can be retried.
  select ac.id into v_id from public.actions ac where ac.recommendation_id = p_rec and ac.path = 'wordpress' and ac.status <> 'failed' limit 1;
  if v_id is not null then return v_id; end if;
  insert into public.actions (tenant_id, brand_id, recommendation_id, path, description, status, performed_by, detail)
  values (r.tenant_id, r.brand_id, p_rec, 'wordpress', 'Draft page: ' || r.title, 'planned', 'truevisible',
          jsonb_build_object('step', 'draft', 'asset_id', r.asset_refs[1], 'requested_by', auth.uid()))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.tv_wp_request_publish(p_action uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.actions set status = 'planned', detail = detail || jsonb_build_object('step', 'publish', 'approved_by', auth.uid(), 'approved_at', now())
   where id = p_action and path = 'wordpress' and status = 'in_progress' and detail->>'step' = 'awaiting_approval'
     and tenant_id in (select private.user_tenant_ids());
  if not found then raise exception 'nothing to publish'; end if;
end $$;

revoke all on function private.tv_can_publish(text) from public, anon, authenticated;
revoke all on function public.tv_wp_request_draft(uuid), public.tv_wp_request_publish(uuid) from public, anon, authenticated;
grant execute on function public.tv_wp_request_draft(uuid), public.tv_wp_request_publish(uuid) to authenticated;

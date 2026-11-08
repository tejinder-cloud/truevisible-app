-- SEO titles & descriptions can be set on WordPress (through Rank Math's fields) with the same request → approve flow.
create or replace function public.tv_wp_request_draft(p_rec uuid, p_as text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r record; v_kind text; v_id uuid;
begin
  if p_as is not null and p_as not in ('page','post') then raise exception 'publish as page or post'; end if;
  select rc.id, rc.tenant_id, rc.brand_id, rc.title, rc.category, rc.asset_refs into r from public.recommendations rc
   where rc.id = p_rec and rc.tenant_id in (select private.user_tenant_ids()) and rc.status in ('open','diy');
  if r.id is null then raise exception 'recommendation not found'; end if;
  if not private.tv_can_publish(r.tenant_id) then raise exception 'publishing is part of managed AEO'; end if;
  if not exists (select 1 from public.integrations i where i.brand_id = r.brand_id and i.provider = 'wordpress' and i.status = 'connected') then
    raise exception 'connect WordPress in Settings first'; end if;
  select a.kind into v_kind from public.assets a where a.id = r.asset_refs[1];
  if v_kind is null or v_kind not in ('page_draft','faq_block','meta') then raise exception 'this change can''t be done on WordPress yet — use the change pack'; end if;
  select ac.id into v_id from public.actions ac where ac.recommendation_id = p_rec and ac.path = 'wordpress' and ac.status <> 'failed' limit 1;
  if v_id is not null then return v_id; end if;
  insert into public.actions (tenant_id, brand_id, recommendation_id, path, description, status, performed_by, detail)
  values (r.tenant_id, r.brand_id, p_rec, 'wordpress',
          case when v_kind = 'meta' then 'SEO titles & descriptions: ' else 'Draft ' || case when p_as = 'post' then 'blog post' else 'page' end || ': ' end || r.title,
          'planned', 'truevisible',
          jsonb_build_object('step', 'draft', 'asset_id', r.asset_refs[1], 'requested_by', auth.uid())
            || case when v_kind = 'meta' then jsonb_build_object('wp_type', 'meta') when p_as is null then '{}'::jsonb else jsonb_build_object('wp_type', p_as) end)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.tv_wp_request_draft(uuid, text) from public, anon, authenticated;
grant execute on function public.tv_wp_request_draft(uuid, text) to authenticated;

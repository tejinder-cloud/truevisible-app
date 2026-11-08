-- The customer may edit the suggested SEO titles/descriptions before applying. Only the text changes: same pages,
-- same fields, same order; each value 1–300 characters.
drop function if exists public.tv_wp_request_publish(uuid);
create or replace function public.tv_wp_request_publish(p_action uuid, p_texts jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_detail jsonb; v_changes jsonb; v_new jsonb;
begin
  select a.detail into v_detail from public.actions a
   where a.id = p_action and a.path = 'wordpress' and a.status = 'in_progress' and a.detail->>'step' = 'awaiting_approval'
     and a.tenant_id in (select private.user_tenant_ids());
  if v_detail is null then raise exception 'nothing to publish'; end if;
  v_changes := coalesce(v_detail->'changes', '[]'::jsonb);
  if p_texts is not null and jsonb_typeof(p_texts) = 'array' and v_detail->>'wp_type' = 'meta' then
    if jsonb_array_length(p_texts) <> jsonb_array_length(v_changes) then raise exception 'edits don''t match the planned changes'; end if;
    if exists (select 1 from jsonb_array_elements(p_texts) t where jsonb_typeof(t) <> 'string' or length(trim(t #>> '{}')) not between 1 and 300) then
      raise exception 'each title and description needs 1–300 characters'; end if;
    select jsonb_agg(c || jsonb_build_object('new', trim(t #>> '{}'), 'edited', (c->>'new') is distinct from trim(t #>> '{}')) order by i)
      into v_new
      from jsonb_array_elements(v_changes) with ordinality as x(c, i)
      join jsonb_array_elements(p_texts) with ordinality as y(t, j) on i = j;
    v_detail := v_detail || jsonb_build_object('changes', v_new);
  end if;
  update public.actions set status = 'planned',
         detail = v_detail || jsonb_build_object('step', 'publish', 'approved_by', auth.uid(), 'approved_at', now())
   where id = p_action;
end $$;
revoke all on function public.tv_wp_request_publish(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.tv_wp_request_publish(uuid, jsonb) to authenticated;

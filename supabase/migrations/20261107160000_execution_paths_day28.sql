-- Day 28: execution paths. WordPress connection through the Easy MCP AI plugin (token kept in Vault),
-- and a link on each logged action so customers can see what changed and where.

create or replace function public.tv_wp_save(p_brand uuid, p_endpoint text, p_token text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_tenant text; v_name text := 'wp_token:' || p_brand::text; v_id uuid;
begin
  select b.tenant_id into v_tenant from public.brands b where b.id = p_brand and b.tenant_id in (select private.user_tenant_ids());
  if v_tenant is null then raise exception 'brand not found'; end if;
  if p_endpoint !~ '^https://[^\s]+$' then raise exception 'endpoint must start with https://'; end if;
  if coalesce(length(p_token), 0) < 16 then raise exception 'token looks too short'; end if;
  select s.id into v_id from vault.secrets s where s.name = v_name;
  if v_id is null then perform vault.create_secret(p_token, v_name, 'WordPress MCP token for TrueVisible brand');
  else perform vault.update_secret(v_id, p_token); end if;
  insert into public.integrations (tenant_id, brand_id, provider, status, config, secret_ref)
  values (v_tenant, p_brand, 'wordpress', 'pending', jsonb_build_object('endpoint', p_endpoint, 'saved_at', now()), v_name)
  on conflict (brand_id, provider) do update set status = 'pending', secret_ref = excluded.secret_ref,
    config = jsonb_build_object('endpoint', p_endpoint, 'saved_at', now());
end $$;

create or replace function public.tv_wp_disconnect(p_brand uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.brands b where b.id = p_brand and b.tenant_id in (select private.user_tenant_ids())) then raise exception 'brand not found'; end if;
  delete from vault.secrets where name = 'wp_token:' || p_brand::text;
  update public.integrations set status = 'revoked', secret_ref = null, config = '{}'::jsonb where brand_id = p_brand and provider = 'wordpress';
end $$;

-- Service role only: the connection check and the Implementer read the token through this.
create or replace function public.svc_wp_token(p_brand uuid)
returns text language sql security definer set search_path = '' as $$
  select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'wp_token:' || p_brand::text;
$$;

revoke all on function public.tv_wp_save(uuid, text, text), public.tv_wp_disconnect(uuid), public.svc_wp_token(uuid) from public, anon, authenticated;
grant execute on function public.tv_wp_save(uuid, text, text), public.tv_wp_disconnect(uuid) to authenticated;
grant execute on function public.svc_wp_token(uuid) to service_role;

alter table public.actions add column if not exists url text check (url is null or url ~ '^https?://');

-- A change pack download is logged so the actions log shows when the changes were handed to the customer's developer.
create or replace function public.tv_log_change_pack(p_brand uuid, p_recs uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_tenant text; v_n int := coalesce(array_length(p_recs, 1), 0);
begin
  select b.tenant_id into v_tenant from public.brands b where b.id = p_brand and b.tenant_id in (select private.user_tenant_ids());
  if v_tenant is null then raise exception 'brand not found'; end if;
  if v_n = 0 then return; end if;
  -- One row per day is enough: repeated downloads the same day update it.
  update public.actions set detail = jsonb_build_object('recommendations', to_jsonb(p_recs), 'count', v_n), performed_at = now(),
         description = 'Change pack downloaded (' || v_n || ' change' || case when v_n = 1 then '' else 's' end || ')'
   where brand_id = p_brand and path = 'change_pack' and (performed_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date;
  if not found then
    insert into public.actions (tenant_id, brand_id, path, description, status, performed_by, performed_at, detail)
    values (v_tenant, p_brand, 'change_pack', 'Change pack downloaded (' || v_n || ' change' || case when v_n = 1 then '' else 's' end || ')',
            'handed_off', 'customer', now(), jsonb_build_object('recommendations', to_jsonb(p_recs), 'count', v_n));
  end if;
end $$;
revoke all on function public.tv_log_change_pack(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.tv_log_change_pack(uuid, uuid[]) to authenticated;

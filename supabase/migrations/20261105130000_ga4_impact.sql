-- Day 24: GA4 Impact. The Google refresh token lives in Supabase Vault (never in a table a customer can read);
-- integrations.config holds only non-secret settings (account email, property list, chosen property).

create table if not exists public.ga4_daily (
  tenant_id        text not null,
  brand_id         uuid not null,
  date             date not null,
  engine           text not null,          -- chatgpt | gemini | perplexity | copilot | claude | other_ai
  source           text not null,          -- GA4 sessionSource as reported
  sessions         int not null default 0,
  engaged_sessions int not null default 0,
  key_events       numeric not null default 0,
  updated_at       timestamptz not null default now(),
  primary key (brand_id, date, source),
  foreign key (brand_id, tenant_id) references public.brands(id, tenant_id) on delete cascade
);
create index if not exists ga4_daily_tenant_idx on public.ga4_daily(tenant_id);
alter table public.ga4_daily enable row level security;
create policy ga4_daily_select on public.ga4_daily for select to authenticated using (tenant_id in (select private.user_tenant_ids()));

create or replace function public.tv_ga4_save_token(p_brand uuid, p_refresh text, p_email text, p_properties jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_tenant text; v_name text := 'ga4_refresh:' || p_brand::text; v_id uuid;
begin
  select b.tenant_id into v_tenant from public.brands b where b.id = p_brand and b.tenant_id in (select private.user_tenant_ids());
  if v_tenant is null then raise exception 'brand not found'; end if;
  if coalesce(length(p_refresh), 0) < 10 then raise exception 'no refresh token'; end if;
  select s.id into v_id from vault.secrets s where s.name = v_name;
  if v_id is null then perform vault.create_secret(p_refresh, v_name, 'GA4 refresh token for TrueVisible brand');
  else perform vault.update_secret(v_id, p_refresh); end if;
  insert into public.integrations (tenant_id, brand_id, provider, status, config, secret_ref)
  values (v_tenant, p_brand, 'ga4', 'pending', jsonb_build_object('account_email', p_email, 'properties', coalesce(p_properties, '[]'::jsonb)), v_name)
  on conflict (brand_id, provider) do update set status = 'pending', secret_ref = excluded.secret_ref,
    config = jsonb_build_object('account_email', p_email, 'properties', coalesce(p_properties, '[]'::jsonb));
end $$;

create or replace function public.tv_ga4_select_property(p_brand uuid, p_property text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_prop jsonb;
begin
  select e into v_prop from public.integrations i, jsonb_array_elements(i.config->'properties') e
   where i.brand_id = p_brand and i.provider = 'ga4' and i.tenant_id in (select private.user_tenant_ids()) and e->>'id' = p_property;
  if v_prop is null then raise exception 'property not found'; end if;
  update public.integrations set status = 'connected',
    config = config || jsonb_build_object('property_id', v_prop->>'id', 'property_name', v_prop->>'name', 'connected_at', now())
   where brand_id = p_brand and provider = 'ga4';
end $$;

create or replace function public.tv_ga4_disconnect(p_brand uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.brands b where b.id = p_brand and b.tenant_id in (select private.user_tenant_ids())) then raise exception 'brand not found'; end if;
  delete from vault.secrets where name = 'ga4_refresh:' || p_brand::text;
  update public.integrations set status = 'revoked', secret_ref = null, config = '{}'::jsonb where brand_id = p_brand and provider = 'ga4';
end $$;

-- Service role only: the GA4 sync reads the token through this.
create or replace function public.svc_ga4_refresh_token(p_brand uuid)
returns text language sql security definer set search_path = '' as $$
  select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'ga4_refresh:' || p_brand::text;
$$;

revoke all on function public.tv_ga4_save_token(uuid, text, text, jsonb), public.tv_ga4_select_property(uuid, text), public.tv_ga4_disconnect(uuid), public.svc_ga4_refresh_token(uuid) from public, anon, authenticated;
grant execute on function public.tv_ga4_save_token(uuid, text, text, jsonb), public.tv_ga4_select_property(uuid, text), public.tv_ga4_disconnect(uuid) to authenticated;
grant execute on function public.svc_ga4_refresh_token(uuid) to service_role;

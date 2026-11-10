-- Day 32: consent to the Terms and Privacy Notice (DPDP Act), and data-erasure requests.
alter table public.tenant_members add column if not exists terms_version text;
alter table public.tenant_members add column if not exists terms_accepted_at timestamptz;

create or replace function public.tv_accept_terms(p_version text) returns void
language sql security definer set search_path = '' as $$
  update public.tenant_members set terms_version = p_version, terms_accepted_at = now() where user_id = auth.uid();
$$;
revoke all on function public.tv_accept_terms(text) from public, anon, authenticated;
grant execute on function public.tv_accept_terms(text) to authenticated;

create table if not exists public.data_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.tenants(id) on update cascade on delete cascade,
  user_id uuid not null,
  email text,
  kind text not null check (kind in ('erasure')),
  reason text check (reason is null or length(reason) <= 500),
  status text not null default 'received' check (status in ('received','done','declined')),
  notified_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.data_requests enable row level security;
drop policy if exists data_requests_select on public.data_requests;
create policy data_requests_select on public.data_requests for select to authenticated using (user_id = auth.uid());
revoke all on public.data_requests from anon, authenticated;
grant select on public.data_requests to authenticated;

-- One open erasure request per person; the team completes it within 30 days (Privacy Notice §5–6).
create or replace function public.tv_request_erasure(p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_tenant text;
begin
  select tenant_id into v_tenant from public.tenant_members where user_id = auth.uid() order by created_at limit 1;
  if v_tenant is null then raise exception 'no workspace'; end if;
  if exists (select 1 from public.data_requests where user_id = auth.uid() and status = 'received') then return; end if;
  insert into public.data_requests (tenant_id, user_id, email, kind, reason)
  values (v_tenant, auth.uid(), (select email from auth.users where id = auth.uid()), 'erasure', nullif(trim(p_reason), ''));
end $$;
revoke all on function public.tv_request_erasure(text) from public, anon, authenticated;
grant execute on function public.tv_request_erasure(text) to authenticated;

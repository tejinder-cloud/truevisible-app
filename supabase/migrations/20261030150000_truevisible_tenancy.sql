-- TrueVisible Day 1 · tenancy + shared tables (SPEC §11, PROJECT-BRIEF "shared Supabase project")
-- tenants.id is TEXT so it matches the existing public.prospects.tenant_id ('tgl' = tenant zero).
-- Also closes the anon hole on public.prospects (policies fell back to 'tgl' for anyone holding the public key).

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

-- ── tenants ─────────────────────────────────────────────────────────────
create table public.tenants (
  id               text primary key check (id ~ '^[a-z0-9_]{2,40}$'),
  name             text not null,
  kind             text not null default 'direct' check (kind in ('direct','agency','agency_client')),
  parent_tenant_id text references public.tenants(id) on delete restrict,   -- agency_client → its agency
  country          text not null default 'IN',
  white_label      jsonb not null default '{}'::jsonb,                      -- agency branding: logo, colours, sender_name, reply_to (v2 UI)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint agency_client_has_parent check ((kind = 'agency_client') = (parent_tenant_id is not null))
);
comment on table public.tenants is 'Shared by TrueVisible, TrueLead and tgl-ops. direct | agency | agency_client. ''tgl'' is tenant zero.';
create index tenants_parent_idx on public.tenants(parent_tenant_id);
create trigger tenants_updated_at before update on public.tenants for each row execute function private.set_updated_at();

insert into public.tenants (id, name, kind) values ('tgl', 'The Growth Lab', 'direct') on conflict (id) do nothing;

-- ── tenant_members (auth.users ↔ tenants) ───────────────────────────────
create table public.tenant_members (
  tenant_id  text not null references public.tenants(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'owner' check (role in ('owner','admin','member','viewer')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index tenant_members_user_idx on public.tenant_members(user_id);

-- Tenants the signed-in user may see: their own, plus an agency's client tenants.
create or replace function private.user_tenant_ids() returns setof text
language sql stable security definer set search_path = '' as $$
  select m.tenant_id from public.tenant_members m where m.user_id = (select auth.uid())
  union
  select t.id from public.tenants t
    join public.tenant_members m on m.tenant_id = t.parent_tenant_id
   where m.user_id = (select auth.uid()) and t.kind = 'agency_client'
$$;
revoke all on function private.user_tenant_ids() from public, anon;
grant execute on function private.user_tenant_ids() to authenticated;

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;

create policy tenants_select on public.tenants for select to authenticated
  using (id in (select private.user_tenant_ids()));
create policy tenants_update on public.tenants for update to authenticated
  using (id in (select m.tenant_id from public.tenant_members m where m.user_id = (select auth.uid()) and m.role in ('owner','admin')))
  with check (id in (select m.tenant_id from public.tenant_members m where m.user_id = (select auth.uid()) and m.role in ('owner','admin')));
create policy tenant_members_select on public.tenant_members for select to authenticated
  using (tenant_id in (select private.user_tenant_ids()));
-- Inserts into tenants / tenant_members happen only through security-definer RPCs or the service role.

-- ── prospects: replace 'tgl' fallback with membership ───────────────────
drop policy if exists prospects_tenant_isolation_select on public.prospects;
drop policy if exists prospects_tenant_isolation_insert on public.prospects;
drop policy if exists prospects_tenant_isolation_update on public.prospects;
drop policy if exists prospects_tenant_isolation_delete on public.prospects;
create policy prospects_tenant_select on public.prospects for select to authenticated
  using (tenant_id in (select private.user_tenant_ids()));
create policy prospects_tenant_insert on public.prospects for insert to authenticated
  with check (tenant_id in (select private.user_tenant_ids()));
create policy prospects_tenant_update on public.prospects for update to authenticated
  using (tenant_id in (select private.user_tenant_ids()))
  with check (tenant_id in (select private.user_tenant_ids()));
create policy prospects_tenant_delete on public.prospects for delete to authenticated
  using (tenant_id in (select private.user_tenant_ids()));

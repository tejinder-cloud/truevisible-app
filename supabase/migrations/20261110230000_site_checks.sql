-- Site health (10 Nov 2026): is the brand's website hidden from search engines or AI crawlers? Written by tgl-ops.
create table if not exists public.site_checks (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  brand_id uuid not null,
  domain text not null,
  http_status int,
  directives text[] not null default '{}',
  blocked_bots text[] not null default '{}',
  issues jsonb not null default '[]',      -- [{code, severity: critical|warning, text}]
  checked_at timestamptz not null default now(),
  foreign key (brand_id, tenant_id) references public.brands(id, tenant_id) on update cascade on delete cascade
);
create index if not exists site_checks_brand_idx on public.site_checks (brand_id, checked_at desc);
alter table public.site_checks enable row level security;
drop policy if exists site_checks_select on public.site_checks;
create policy site_checks_select on public.site_checks for select to authenticated using (tenant_id in (select private.user_tenant_ids()));
revoke all on public.site_checks from anon, authenticated;
grant select on public.site_checks to authenticated;

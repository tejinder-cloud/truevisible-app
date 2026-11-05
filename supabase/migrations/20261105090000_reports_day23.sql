-- Day 23: daily digest + weekly trend. Content is structured data computed from stored runs (rendered by app and email).
alter table public.reports
  add column if not exists summary text,
  add column if not exists content jsonb not null default '{}'::jsonb,
  add column if not exists email_recipients int not null default 0,
  add column if not exists email_error text;
create unique index if not exists reports_one_per_period on public.reports(brand_id, kind, period_end);

-- Per-person email choices (default on). Changed only through tv_set_email_prefs.
alter table public.tenant_members
  add column if not exists email_daily boolean not null default true,
  add column if not exists email_weekly boolean not null default true;

create or replace function public.tv_set_email_prefs(p_daily boolean, p_weekly boolean)
returns void language sql security definer set search_path = '' as $$
  update public.tenant_members set email_daily = p_daily, email_weekly = p_weekly where user_id = auth.uid();
$$;
revoke all on function public.tv_set_email_prefs(boolean, boolean) from public, anon;
grant execute on function public.tv_set_email_prefs(boolean, boolean) to authenticated;

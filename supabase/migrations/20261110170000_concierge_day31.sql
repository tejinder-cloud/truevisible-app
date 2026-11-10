-- Day 31: Customer Success + Trial Concierge. When each person last opened the dashboard, whether they want tips and
-- reminders, and a log of every journey email so none is sent twice.
alter table public.tenant_members add column if not exists last_seen_at timestamptz;
alter table public.tenant_members add column if not exists email_tips boolean not null default true;

create table if not exists public.lifecycle_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.tenants(id) on update cascade on delete cascade,
  brand_id uuid,
  kind text not null,            -- e.g. finish_setup_24h, trial_day3, inactive:2026-11
  sent_at timestamptz not null default now(),
  recipients int not null default 0,
  error text,
  unique (tenant_id, kind)
);
alter table public.lifecycle_messages enable row level security;   -- internal only: no customer policies
revoke all on public.lifecycle_messages from anon, authenticated;

-- The dashboard calls this on each page; it writes at most once an hour per person.
create or replace function public.tv_touch() returns void
language sql security definer set search_path = '' as $$
  update public.tenant_members set last_seen_at = now()
   where user_id = auth.uid() and (last_seen_at is null or last_seen_at < now() - interval '1 hour');
$$;
revoke all on function public.tv_touch() from public, anon, authenticated;
grant execute on function public.tv_touch() to authenticated;

-- Email choices gain "tips and reminders" (trial and account emails); old two-argument calls keep working.
drop function if exists public.tv_set_email_prefs(boolean, boolean);
create or replace function public.tv_set_email_prefs(p_daily boolean, p_weekly boolean, p_tips boolean default null)
returns void language sql security definer set search_path = '' as $$
  update public.tenant_members set email_daily = p_daily, email_weekly = p_weekly, email_tips = coalesce(p_tips, email_tips) where user_id = auth.uid();
$$;
revoke all on function public.tv_set_email_prefs(boolean, boolean, boolean) from public, anon;
grant execute on function public.tv_set_email_prefs(boolean, boolean, boolean) to authenticated;

-- Day 29b: the 90-day plan for managed AEO (SPEC §8). Drafted by tgl-ops (Strategist), checked in code, approved by
-- a person (or automatically when every check passes, once review mode is "flagged"), then shown to the customer.
create table if not exists public.aeo_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  brand_id uuid not null,
  tier text not null check (tier in ('managed','managed_plus')),
  status text not null default 'pending_review' check (status in ('pending_review','approved','needs_changes','superseded','failed')),
  starts_on date,
  ends_on date,
  scope jsonb not null,          -- {pages_per_month, outreach_per_month, gbp_profiles, prompts_in_scope} — set by code from the tier
  baseline jsonb not null,       -- measured by code from stored runs: {from, to, answers, named, competitors_named_most, own_site_cited}
  summary text not null,
  months jsonb not null,         -- [{month, theme, focus}]
  items jsonb not null,          -- [{id, week, title, detail, kind, path, count, recommendation_id}]
  checks jsonb not null,         -- {passed, problems[]}
  review jsonb,                  -- {mode, decided_by, decided_at, auto, instructions, slack_channel, slack_ts}
  cost_usd numeric,
  created_at timestamptz not null default now(),
  foreign key (brand_id, tenant_id) references public.brands(id, tenant_id) on update cascade on delete cascade
);
create index if not exists aeo_plans_brand_idx on public.aeo_plans (brand_id, created_at desc);
alter table public.aeo_plans enable row level security;
-- Customers see only plans a person (or the automatic checks) approved; drafts and review notes stay internal.
drop policy if exists aeo_plans_select on public.aeo_plans;
create policy aeo_plans_select on public.aeo_plans for select to authenticated
  using (tenant_id in (select private.user_tenant_ids()) and status in ('approved','superseded'));
revoke all on public.aeo_plans from anon, authenticated;
-- Column grant: review notes, check results and cost are never readable by customers.
grant select (id, tenant_id, brand_id, tier, status, starts_on, ends_on, scope, baseline, summary, months, items, created_at) on public.aeo_plans to authenticated;

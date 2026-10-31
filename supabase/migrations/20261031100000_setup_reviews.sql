-- Setup-verification queue (plan Day 19). Internal: written and read by tgl-ops (service role) only.
create table public.setup_reviews (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     text not null,
  brand_id      uuid not null,
  status        text not null default 'proposed' check (status in ('proposed','approved','changes_requested','superseded','failed')),
  proposal      jsonb,                 -- agent's suggested changes + evidence
  applied       jsonb,                 -- what the reviewer actually applied
  evidence      jsonb,                 -- site snapshot + AI answer used, for audit
  slack_channel text,
  slack_ts      text,
  decided_by    text,
  decided_at    timestamptz,
  note          text,                  -- reviewer's note to the customer (changes_requested)
  reminded_at   timestamptz,
  error         text,
  created_at    timestamptz not null default now(),
  foreign key (brand_id, tenant_id) references public.brands(id, tenant_id) on delete cascade on update cascade
);
create index setup_reviews_brand_idx on public.setup_reviews(brand_id, created_at desc);
create index setup_reviews_tenant_idx on public.setup_reviews(tenant_id);
create unique index setup_reviews_one_open on public.setup_reviews(brand_id) where status = 'proposed';
alter table public.setup_reviews enable row level security;   -- no client policies: internal only

-- Customer-facing message when a setup needs changes (shown on the dashboard).
alter table public.brands add column if not exists setup_note text;

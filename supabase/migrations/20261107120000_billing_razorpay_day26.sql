-- Day 26b: self-serve Track checkout with Razorpay Subscriptions (applied 7 Nov 2026).
-- Activation needs Razorpay's payment signature, checked in the database with the key secret held in Vault
-- ('razorpay_key_secret', kept in sync from tgl-ops' env), so a customer can't activate a plan without paying.
create table if not exists public.billing_checkouts (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                text not null references public.tenants(id) on delete cascade,
  user_id                  uuid,
  plan                     text not null check (plan in ('track')),
  billing_interval         text not null check (billing_interval in ('month','year')),
  currency                 text not null check (currency in ('INR','USD')),
  price_minor              bigint not null check (price_minor >= 0),
  gst_rate                 numeric not null default 0,
  razorpay_subscription_id text not null unique,
  gstin                    text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z0-9]{13}$'),
  legal_name               text check (length(legal_name) <= 200),
  status                   text not null default 'created' check (status in ('created','active','failed')),
  created_at               timestamptz not null default now()
);
create index if not exists billing_checkouts_tenant_idx on public.billing_checkouts(tenant_id, created_at desc);
alter table public.billing_checkouts enable row level security;
create policy billing_checkouts_select on public.billing_checkouts for select to authenticated using (tenant_id in (select private.user_tenant_ids()));
alter table public.invoices add column if not exists razorpay_payment_id text unique;
alter table public.invoices add column if not exists period_start date, add column if not exists period_end date;
-- Functions tv_billing_checkout_created, tv_billing_confirm (HMAC via extensions.hmac against the Vault secret),
-- svc_set_razorpay_secret (service role only): see migration "billing_razorpay_day26" in Supabase.

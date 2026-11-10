-- Day 32b: GST tax invoices. The customer's state decides the tax (place of supply); invoice numbers run in one
-- unbroken series per financial year; PDFs are kept privately per workspace.
alter table public.billing_checkouts add column if not exists state_code text check (state_code is null or state_code ~ '^[0-9]{2}$');
alter table public.invoices add column if not exists tax jsonb;   -- the breakdown printed on the invoice

drop function if exists public.tv_billing_checkout_created(text, text, text, bigint, numeric, text, text);
create or replace function public.tv_billing_checkout_created(p_subscription_id text, p_interval text, p_currency text, p_price_minor bigint, p_gst_rate numeric, p_gstin text, p_legal_name text, p_state text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_tenant text; v_state text := nullif(trim(p_state), '');
begin
  select m.tenant_id into v_tenant from public.tenant_members m where m.user_id = auth.uid() and m.role in ('owner','admin') order by m.created_at limit 1;
  if v_tenant is null then raise exception 'only the workspace owner can upgrade'; end if;
  if nullif(trim(p_gstin), '') is not null then v_state := left(upper(trim(p_gstin)), 2); end if;   -- a GSTIN carries its state
  insert into public.billing_checkouts (tenant_id, user_id, plan, billing_interval, currency, price_minor, gst_rate, razorpay_subscription_id, gstin, legal_name, state_code)
  values (v_tenant, auth.uid(), 'track', p_interval, p_currency, p_price_minor, p_gst_rate, p_subscription_id, nullif(upper(trim(p_gstin)), ''), nullif(trim(p_legal_name), ''), v_state);
end $$;
revoke all on function public.tv_billing_checkout_created(text, text, text, bigint, numeric, text, text, text) from public, anon, authenticated;
grant execute on function public.tv_billing_checkout_created(text, text, text, bigint, numeric, text, text, text) to authenticated;

-- One gapless series per financial year (e.g. FM/2026-27/0001), allocated by tgl-ops only.
create table if not exists public.invoice_counters (fy text primary key, last int not null default 0);
alter table public.invoice_counters enable row level security;
revoke all on public.invoice_counters from anon, authenticated;
create or replace function public.svc_next_invoice_seq(p_fy text) returns int
language sql security definer set search_path = '' as $$
  insert into public.invoice_counters (fy, last) values (p_fy, 1)
  on conflict (fy) do update set last = public.invoice_counters.last + 1
  returning last;
$$;
revoke all on function public.svc_next_invoice_seq(text) from public, anon, authenticated;
grant execute on function public.svc_next_invoice_seq(text) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoices', 'invoices', false, 2097152, array['application/pdf'])
on conflict (id) do nothing;
drop policy if exists invoices_pdf_read on storage.objects;
create policy invoices_pdf_read on storage.objects for select to authenticated
  using (bucket_id = 'invoices' and (storage.foldername(name))[1] in (select private.user_tenant_ids()));

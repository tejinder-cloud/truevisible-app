-- Day 22: recommendations + "Start managed AEO".
-- Recommendations and assets are written by the service role (the recommender agent). Customers may only change
-- a recommendation's status, through tv_set_recommendation_status; managed-AEO requests go through tv_request_managed_aeo.

alter table public.recommendations drop constraint if exists recommendations_status_check;
alter table public.recommendations add constraint recommendations_status_check
  check (status in ('open','diy','managed','done','dismissed','superseded'));
alter table public.recommendations
  add column if not exists category text check (category in ('offsite','onsite','content','technical')),
  add column if not exists evidence jsonb not null default '{}'::jsonb,   -- counts computed by code from stored runs, never by the model
  add column if not exists batch_id uuid;                                 -- one generation = one batch

create table if not exists public.managed_aeo_requests (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         text not null,
  brand_id          uuid not null,
  user_id           uuid,
  email             text,
  recommendation_id uuid,
  note              text check (length(note) <= 1000),
  status            text not null default 'new' check (status in ('new','contacted','won','lost')),
  slack_ts          text,
  notified_at       timestamptz,
  created_at        timestamptz not null default now(),
  foreign key (brand_id, tenant_id) references public.brands(id, tenant_id) on delete cascade,
  foreign key (recommendation_id, tenant_id) references public.recommendations(id, tenant_id) on delete set null (recommendation_id)
);
create index if not exists managed_aeo_requests_brand_idx on public.managed_aeo_requests(brand_id, created_at desc);
alter table public.managed_aeo_requests enable row level security;
create policy managed_aeo_requests_select on public.managed_aeo_requests for select to authenticated
  using (tenant_id in (select private.user_tenant_ids()));

create or replace function public.tv_set_recommendation_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('open','diy','done','dismissed') then raise exception 'status not allowed'; end if;
  update public.recommendations set status = p_status
   where id = p_id and tenant_id in (select private.user_tenant_ids()) and status <> 'superseded';
  if not found then raise exception 'recommendation not found'; end if;
end $$;

create or replace function public.tv_request_managed_aeo(p_brand uuid, p_recommendation uuid default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_tenant text; v_id uuid;
begin
  select b.tenant_id into v_tenant from public.brands b where b.id = p_brand and b.tenant_id in (select private.user_tenant_ids());
  if v_tenant is null then raise exception 'brand not found'; end if;
  -- One open request per brand a week: pressing the button twice doesn't page the team twice.
  select r.id into v_id from public.managed_aeo_requests r
   where r.brand_id = p_brand and r.status = 'new' and r.created_at > now() - interval '7 days' order by r.created_at desc limit 1;
  if v_id is not null then return v_id; end if;
  insert into public.managed_aeo_requests (tenant_id, brand_id, user_id, email, recommendation_id, note)
  values (v_tenant, p_brand, auth.uid(), (select u.email from auth.users u where u.id = auth.uid()), p_recommendation, nullif(left(trim(p_note), 1000), ''))
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.tv_set_recommendation_status(uuid, text), public.tv_request_managed_aeo(uuid, uuid, text) from public, anon;
grant execute on function public.tv_set_recommendation_status(uuid, text), public.tv_request_managed_aeo(uuid, uuid, text) to authenticated;

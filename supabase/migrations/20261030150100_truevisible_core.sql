-- TrueVisible Day 1 · brand setup + measurement tables (SPEC §11)
-- Every row carries tenant_id; child rows use composite FKs (x_id, tenant_id) so a row can never point at another tenant's brand.

-- ── brands ──────────────────────────────────────────────────────────────
create table public.brands (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        text not null references public.tenants(id) on delete cascade,
  agency_id        text references public.tenants(id) on delete set null,   -- set when an agency manages this brand (data model v1, UI v2)
  name             text not null,
  primary_domain   text,
  site_platform    text check (site_platform in ('wordpress','shopify','webflow','wix','squarespace','custom','none')),
  languages        text[] not null default '{en}',
  white_label      jsonb not null default '{}'::jsonb,
  onboarding_step  smallint not null default 1 check (onboarding_step between 1 and 4),  -- 4 = wizard finished
  setup_status     text not null default 'draft' check (setup_status in ('draft','pending_verification','verified','needs_changes')),
  setup_verified_at timestamptz,
  setup_verified_by text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, tenant_id)
);
create index brands_tenant_idx on public.brands(tenant_id);
create index brands_agency_idx on public.brands(agency_id);
create trigger brands_updated_at before update on public.brands for each row execute function private.set_updated_at();

create table public.brand_variants (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  text not null,
  brand_id   uuid not null,
  name       text not null,
  source     text not null default 'user' check (source in ('user','suggested','setup_agent')),
  created_at timestamptz not null default now(),
  foreign key (brand_id, tenant_id) references public.brands(id, tenant_id) on delete cascade,
  unique (brand_id, name)
);
create index brand_variants_tenant_idx on public.brand_variants(tenant_id);

create table public.domains (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  text not null,
  brand_id   uuid not null,
  domain     text not null check (domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (brand_id, tenant_id) references public.brands(id, tenant_id) on delete cascade,
  unique (brand_id, domain)
);
create index domains_tenant_idx on public.domains(tenant_id);

create table public.competitors (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   text not null,
  brand_id    uuid not null,
  name        text not null,
  domain      text,
  source      text not null default 'user' check (source in ('user','suggested','setup_agent')),
  verified_at timestamptz,
  status      text not null default 'active' check (status in ('active','rejected','retired')),
  created_at  timestamptz not null default now(),
  foreign key (brand_id, tenant_id) references public.brands(id, tenant_id) on delete cascade,
  unique (brand_id, name)
);
create index competitors_tenant_idx on public.competitors(tenant_id);

create table public.products_icps (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   text not null,
  brand_id    uuid not null,
  product     text not null,
  icp         text not null,
  location    text not null,
  verified_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (brand_id, tenant_id) references public.brands(id, tenant_id) on delete cascade
);
create index products_icps_brand_idx on public.products_icps(brand_id);
create index products_icps_tenant_idx on public.products_icps(tenant_id);

create table public.prompts (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      text not null,
  brand_id       uuid not null,
  product_icp_id uuid,
  text           text not null check (length(text) between 5 and 500),
  language       text not null default 'en' check (language in ('en','hi','hinglish','pa','ta','te','mr','bn')),
  journey_phase  text not null check (journey_phase in ('awareness','consideration','decision')),
  status         text not null default 'active' check (status in ('draft','active','retired')),
  source         text not null default 'user' check (source in ('user','template','generated','setup_agent')),
  created_at     timestamptz not null default now(),
  retired_at     timestamptz,
  unique (id, tenant_id),
  foreign key (brand_id, tenant_id) references public.brands(id, tenant_id) on delete cascade,
  foreign key (product_icp_id, tenant_id) references public.products_icps(id, tenant_id) on delete set null (product_icp_id)
);
create index prompts_brand_status_idx on public.prompts(brand_id, status);
create index prompts_tenant_idx on public.prompts(tenant_id);
create index prompts_product_icp_idx on public.prompts(product_icp_id);

-- ── measurement (written by engine runners with the service role) ───────
create table public.runs (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   text not null,
  brand_id    uuid not null,
  run_date    date not null default current_date,
  engine      text not null check (engine in ('chatgpt','gemini','perplexity','ai_overviews','copilot','meta_ai')),
  kind        text not null default 'daily' check (kind in ('audit','daily','manual')),
  status      text not null default 'queued' check (status in ('queued','running','succeeded','partial','failed')),
  started_at  timestamptz,
  finished_at timestamptz,
  error       text,
  created_at  timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (brand_id, tenant_id) references public.brands(id, tenant_id) on delete cascade
);
create index runs_brand_date_idx on public.runs(brand_id, run_date desc, engine);
create index runs_tenant_idx on public.runs(tenant_id);

create table public.answers (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             text not null,
  brand_id              uuid not null,
  run_id                uuid not null,
  prompt_id             uuid not null,
  text                  text,
  mentioned             boolean,
  position              smallint check (position > 0),
  sentiment             text check (sentiment in ('positive','neutral','negative')),
  competitors_mentioned text[] not null default '{}',
  raw                   jsonb,
  created_at            timestamptz not null default now(),
  unique (id, tenant_id),
  unique (run_id, prompt_id),
  foreign key (run_id, tenant_id) references public.runs(id, tenant_id) on delete cascade,
  foreign key (prompt_id, tenant_id) references public.prompts(id, tenant_id) on delete cascade,
  foreign key (brand_id, tenant_id) references public.brands(id, tenant_id) on delete cascade
);
create index answers_prompt_idx on public.answers(prompt_id);
create index answers_brand_idx on public.answers(brand_id, created_at desc);
create index answers_tenant_idx on public.answers(tenant_id);

create table public.citations (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             text not null,
  brand_id              uuid not null,
  answer_id             uuid not null,
  domain                text not null,
  url                   text,
  channel_type          text check (channel_type in ('owned','earned','social','directory','marketplace','news','reference','forum','video','other')),
  content_type          text check (content_type in ('homepage','product','blog','listicle','review','comparison','faq','docs','profile','thread','video','other')),
  brand_mentioned       boolean,
  competitors_mentioned text[] not null default '{}',
  created_at            timestamptz not null default now(),
  foreign key (answer_id, tenant_id) references public.answers(id, tenant_id) on delete cascade,
  foreign key (brand_id, tenant_id) references public.brands(id, tenant_id) on delete cascade
);
create index citations_answer_idx on public.citations(answer_id);
create index citations_brand_domain_idx on public.citations(brand_id, domain);
create index citations_tenant_idx on public.citations(tenant_id);

create table public.hallucinations (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    text not null,
  brand_id     uuid not null,
  answer_id    uuid,
  claim        text not null,
  correct_fact text,
  status       text not null default 'open' check (status in ('open','fixing','fixed','dismissed')),
  detected_at  timestamptz not null default now(),
  fixed_at     timestamptz,
  foreign key (brand_id, tenant_id) references public.brands(id, tenant_id) on delete cascade,
  foreign key (answer_id, tenant_id) references public.answers(id, tenant_id) on delete set null (answer_id)
);
create index hallucinations_brand_idx on public.hallucinations(brand_id, status);
create index hallucinations_answer_idx on public.hallucinations(answer_id);
create index hallucinations_tenant_idx on public.hallucinations(tenant_id);

-- ── recommendations / assets / actions ──────────────────────────────────
create table public.assets (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    text not null,
  brand_id     uuid not null,
  kind         text not null check (kind in ('page_draft','faq_block','json_ld','llms_txt','meta','gbp_edits','directory_list','thread_list','change_pack','other')),
  title        text not null,
  content      jsonb,
  storage_path text,                       -- Supabase Storage key when the asset is a file
  created_at   timestamptz not null default now(),
  foreign key (brand_id, tenant_id) references public.brands(id, tenant_id) on delete cascade
);
create index assets_brand_idx on public.assets(brand_id);
create index assets_tenant_idx on public.assets(tenant_id);

create table public.recommendations (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   text not null,
  brand_id    uuid not null,
  title       text not null,
  body        text,
  impact      smallint check (impact between 1 and 5),
  ease        smallint check (ease between 1 and 5),
  priority    smallint generated always as (impact * ease) stored,
  asset_refs  uuid[] not null default '{}',
  status      text not null default 'open' check (status in ('open','diy','managed','done','dismissed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (brand_id, tenant_id) references public.brands(id, tenant_id) on delete cascade
);
create index recommendations_brand_idx on public.recommendations(brand_id, status, priority desc);
create index recommendations_tenant_idx on public.recommendations(tenant_id);
create trigger recommendations_updated_at before update on public.recommendations for each row execute function private.set_updated_at();

create table public.actions (           -- Implementer log
  id                uuid primary key default gen_random_uuid(),
  tenant_id         text not null,
  brand_id          uuid not null,
  recommendation_id uuid,
  path              text not null check (path in ('offsite','wordpress','shopify','webflow','wix','squarespace','change_pack')),
  description       text not null,
  status            text not null default 'planned' check (status in ('planned','in_progress','done','failed','handed_off')),
  performed_by      text,                 -- agent or person
  performed_at      timestamptz,
  detail            jsonb,
  created_at        timestamptz not null default now(),
  foreign key (brand_id, tenant_id) references public.brands(id, tenant_id) on delete cascade,
  foreign key (recommendation_id, tenant_id) references public.recommendations(id, tenant_id) on delete set null (recommendation_id)
);
create index actions_brand_idx on public.actions(brand_id, created_at desc);
create index actions_recommendation_idx on public.actions(recommendation_id);
create index actions_tenant_idx on public.actions(tenant_id);

-- ── reports / alerts / integrations ─────────────────────────────────────
create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    text not null,
  brand_id     uuid not null,
  kind         text not null check (kind in ('audit','daily','weekly','monthly')),
  period_start date,
  period_end   date,
  url          text,
  emailed_at   timestamptz,
  created_at   timestamptz not null default now(),
  foreign key (brand_id, tenant_id) references public.brands(id, tenant_id) on delete cascade
);
create index reports_brand_idx on public.reports(brand_id, kind, created_at desc);
create index reports_tenant_idx on public.reports(tenant_id);

create table public.alerts (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  text not null,
  brand_id   uuid not null,
  kind       text not null check (kind in ('visibility_drop','hallucination','competitor_overtake','report_ready')),
  channel    text not null default 'whatsapp' check (channel in ('whatsapp','email','dashboard')),
  message    text not null,
  payload    jsonb,
  status     text not null default 'pending' check (status in ('pending','sent','failed','suppressed')),
  sent_at    timestamptz,
  created_at timestamptz not null default now(),
  foreign key (brand_id, tenant_id) references public.brands(id, tenant_id) on delete cascade
);
create index alerts_brand_idx on public.alerts(brand_id, created_at desc);
create index alerts_tenant_idx on public.alerts(tenant_id);

create table public.integrations (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  text not null,
  brand_id   uuid not null,
  provider   text not null check (provider in ('ga4','wordpress','gbp','shopify','webflow','wix','squarespace')),
  status     text not null default 'pending' check (status in ('pending','connected','error','revoked')),
  config     jsonb not null default '{}'::jsonb,   -- non-secret settings only
  secret_ref text,                                  -- Vault secret name; tokens never stored in this table
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (brand_id, tenant_id) references public.brands(id, tenant_id) on delete cascade,
  unique (brand_id, provider)
);
create index integrations_tenant_idx on public.integrations(tenant_id);
create trigger integrations_updated_at before update on public.integrations for each row execute function private.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  -- read for members on every tenant table
  foreach t in array array['brands','brand_variants','domains','competitors','products_icps','prompts','runs','answers','citations',
                           'hallucinations','assets','recommendations','actions','reports','alerts','integrations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (tenant_id in (select private.user_tenant_ids()))', t||'_select', t);
  end loop;
  -- client-editable setup tables (wizard + settings)
  foreach t in array array['brands','brand_variants','domains','competitors','products_icps','prompts'] loop
    execute format('create policy %I on public.%I for insert to authenticated with check (tenant_id in (select private.user_tenant_ids()))', t||'_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (tenant_id in (select private.user_tenant_ids())) with check (tenant_id in (select private.user_tenant_ids()))', t||'_update', t);
  end loop;
  foreach t in array array['brand_variants','domains','competitors','products_icps','prompts'] loop
    execute format('create policy %I on public.%I for delete to authenticated using (tenant_id in (select private.user_tenant_ids()))', t||'_delete', t);
  end loop;
end $$;
-- runs/answers/citations/hallucinations/assets/recommendations/actions/reports/alerts/integrations are written by the service role only (v1).

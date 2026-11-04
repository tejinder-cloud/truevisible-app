-- The completed Citation Tracker run a recommendations batch was built from (one batch per run at most).
alter table public.recommendations add column if not exists run_id uuid;
create index if not exists recommendations_run_idx on public.recommendations(brand_id, run_id);

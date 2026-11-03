-- When the customer last finished the setup wizard. The first-audit queue (tgl-ops, every minute) runs a brand whose submission is newer than its latest run.
alter table public.brands add column if not exists setup_submitted_at timestamptz;
update public.brands set setup_submitted_at = updated_at where onboarding_step = 4 and setup_submitted_at is null;

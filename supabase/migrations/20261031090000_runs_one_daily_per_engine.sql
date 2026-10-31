-- Citation Tracker (Day 17): one live daily run per brand × engine × day. Failed runs don't count, so a retry is allowed.
create unique index if not exists runs_one_daily_per_engine
  on public.runs (brand_id, run_date, engine)
  where kind = 'daily' and status in ('running', 'succeeded', 'partial');

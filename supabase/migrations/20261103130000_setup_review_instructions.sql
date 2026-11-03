-- Split the reviewer's "Needs changes" input: `note` is shown to the customer; `instructions` go only to the strategist.
alter table public.setup_reviews add column if not exists instructions text;
comment on column public.setup_reviews.note is 'Shown to the customer on their dashboard (brands.setup_note). May be empty.';
comment on column public.setup_reviews.instructions is 'Reviewer instructions for the strategist''s next proposal. Never shown to the customer.';
-- Existing TGL reviews used `note` as instructions to the agent (31 Oct – 3 Nov). Move them, and clear the customer-facing copy.
update public.setup_reviews set instructions = note, note = null where tenant_id = 'tgl' and status = 'changes_requested' and note is not null and instructions is null;
update public.brands set setup_note = null where tenant_id = 'tgl';

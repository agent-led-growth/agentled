-- Laurel: a terminal failure marker for the one-time scan. When a queued run
-- gives up (every prompt failed, or the runner crashed on its final retry) we
-- stamp scan_failed_at, so the dashboard shows an error instead of spinning
-- forever and the failure is visible in the DB. Cleared when a fresh scan is
-- claimed (a manual retry). Mutually exclusive with first_scan_completed_at.
-- Depends on 0005/0008.
--
-- Wrapped in a transaction: run the whole file at once; any failure rolls back.

begin;

alter table public.brands
  add column if not exists scan_failed_at timestamptz;

comment on column public.brands.scan_failed_at is
  'When the one-time scan last failed terminally (all prompts failed / gave up). '
  'Cleared on a new claim. Mutually exclusive with first_scan_completed_at.';

commit;

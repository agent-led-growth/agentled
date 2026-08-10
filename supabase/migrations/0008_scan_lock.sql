-- Laurel scan lock: an in-progress marker so a brand's one-time scan runs at
-- most once. scan/run claims it with a single conditional UPDATE; a 15-minute
-- staleness window auto-recovers from a crashed run and lets a failed scan retry
-- later instead of re-firing on every dashboard open. Depends on 0005 (brands).

begin;

alter table public.brands
  add column if not exists scan_started_at timestamptz;

comment on column public.brands.scan_started_at is
  'When a scan run claimed this brand. The scan lock: a new run is allowed only '
  'if this is null or older than 15 minutes (stale), and first_scan_completed_at '
  'is null.';

commit;

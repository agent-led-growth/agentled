-- Laurel: add a status to scans so a failed run (API error, timeout, empty
-- answer) is distinguishable from a real zero-visibility run. A failed scan
-- still gets a row so the append-only history stays honest, but it is excluded
-- from every metric denominator; a real zero is an 'ok' row with no self-mention
-- and counts normally. See laurel-schema.md (v1.3) and laurel-intelligence.md
-- (resolves open decision 2). Depends on 0006.
--
-- Wrapped in a transaction: run the whole file at once; any failure rolls back.

begin;

alter table public.scans
  add column status text not null default 'ok'
    check (status in ('ok', 'failed'));

-- The core metric read is "ok scans for a brand, on selected platforms, in a
-- window" — this supports the status filter alongside brand and time.
create index scans_brand_status_run_idx
  on public.scans (brand_id, status, run_at desc);

commit;

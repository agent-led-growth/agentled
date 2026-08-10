-- Laurel: persist why a scan failed. A failed scan row (status = 'failed')
-- previously recorded nothing about the cause — the error was only logged at
-- scan time and lost. This column captures a short reason (stage + message,
-- e.g. "search: timed out after 60s" / "extract: 400 invalid_json") so failures
-- are diagnosable after the fact without re-running or tailing the worker. Null
-- on 'ok' rows. Depends on 0006/0007.
--
-- Wrapped in a transaction: run the whole file at once; any failure rolls back.

begin;

alter table public.scans
  add column if not exists error text;

comment on column public.scans.error is
  'Why a failed scan failed (stage + message), for diagnosis. Null on ok rows.';

commit;

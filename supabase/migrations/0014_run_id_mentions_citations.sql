-- Denormalise run_id onto mentions + citations (Epic 4, slice 4.1). scans already
-- carries run_id (0012); mentions/citations only had scan_id, which forced the
-- trend to filter by huge .in(scan_id, …) lists (URL-limit crashes on big brands)
-- or to fetch all-time rows. With run_id here, every metrics read scopes by the
-- handful of run ids in the window. Backfills existing rows from their scan.
--
-- Depends on 0006 (mentions, citations), 0012 (scan_runs, scans.run_id). Read-safe.

begin;

alter table public.mentions
  add column if not exists run_id uuid references public.scan_runs (id) on delete set null;
alter table public.citations
  add column if not exists run_id uuid references public.scan_runs (id) on delete set null;

-- Backfill from each row's scan (null where the scan predates run_id).
update public.mentions m
  set run_id = s.run_id
  from public.scans s
  where s.id = m.scan_id and m.run_id is null;
update public.citations c
  set run_id = s.run_id
  from public.scans s
  where s.id = c.scan_id and c.run_id is null;

create index if not exists mentions_run_idx on public.mentions (run_id);
create index if not exists citations_run_idx on public.citations (run_id);

commit;

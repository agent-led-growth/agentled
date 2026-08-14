-- Backfill legacy scans into scan_runs (Epic 4, slice 4.1 review L1). Metrics now
-- read history through scan_runs, so a brand scanned before the run-aware executor
-- (its scans have run_id = null and there's NO scan_run) would return empty and the
-- dashboard would go blank. This mints ONE synthetic completed run per such brand
-- and stamps run_id onto its scan/mention/citation rows, so the metrics layer needs
-- no legacy special-case.
--
-- Pre-run-era one-time scans were overwritten each run (deleteBrandScans), so a
-- brand's null-run_id scans are exactly one run's worth. Brands that already have a
-- scan_run (scanned under the new pipeline) are left untouched.
--
-- Depends on 0006 (scans/mentions/citations), 0012 (scan_runs), 0014 (m/c run_id).

begin;

with legacy as (
  select
    s.brand_id,
    min(s.run_at)                             as first_at,
    max(s.run_at)                             as last_at,
    max(s.model)                              as model,
    count(*)                                  as attempted,
    count(*) filter (where s.status = 'ok')   as completed
  from public.scans s
  where s.run_id is null
    and not exists (select 1 from public.scan_runs r where r.brand_id = s.brand_id)
  group by s.brand_id
),
made as (
  insert into public.scan_runs
    (brand_id, user_id, status, trigger, model,
     started_at, completed_at, prompts_attempted, prompts_completed)
  select
    l.brand_id,
    (select bu.user_id from public.brand_users bu
       where bu.brand_id = l.brand_id order by (bu.role = 'owner') desc limit 1),
    'completed', 'onboarding', l.model,
    coalesce(l.first_at, now()), coalesce(l.last_at, now()),
    l.attempted, l.completed
  from legacy l
  returning id, brand_id
)
update public.scans s
  set run_id = m.id
  from made m
  where s.brand_id = m.brand_id and s.run_id is null;

-- mentions/citations: derive run_id from the now-stamped scans. 0014 set these to
-- null for legacy rows because scans.run_id was still null at that point.
update public.mentions mn
  set run_id = s.run_id
  from public.scans s
  where s.id = mn.scan_id and mn.run_id is null and s.run_id is not null;

update public.citations c
  set run_id = s.run_id
  from public.scans s
  where s.id = c.scan_id and c.run_id is null and s.run_id is not null;

commit;

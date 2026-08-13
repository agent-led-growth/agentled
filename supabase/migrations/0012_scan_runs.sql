-- Recurring scans + history (Epic 4). A scan_run is one execution of a brand's
-- prompts — the durable record that lets daily runs accumulate instead of
-- overwriting. The scan unit is the per-account brand row (never a shared
-- domain): every run and result is scoped by brand_id, exactly like 0006.
--
-- Depends on 0003 (users), 0005 (brands, prompts, is_brand_member), 0006 (scans).
-- Wrapped in a transaction: run the whole file at once; any failure rolls back.

begin;

-- ── scan_runs ────────────────────────────────────────────────────────────────
-- One row per run. State machine: pending -> running -> completed | failed; a
-- terminal row is never updated. `user_id` is the owner (denormalised from
-- brand_users for "all my runs" and the weekly report). The partial unique index
-- enforces at most one in-flight run per brand row, which makes the daily-sweep
-- enqueue idempotent: a second enqueue trips the constraint instead of starting a
-- concurrent run. Model/cost are recorded (not derived) so a historical run always
-- reflects what actually happened.
create table public.scan_runs (
  id                uuid primary key default gen_random_uuid(),
  brand_id          uuid not null references public.brands (id) on delete cascade,
  user_id           uuid references public.users (id) on delete set null,
  status            text not null default 'pending',   -- pending|running|completed|failed
  trigger           text not null,                      -- onboarding|scheduled|manual
  model             text,                               -- exact model string used
  prompts_attempted int  not null default 0,
  prompts_completed int  not null default 0,
  error             text,
  cost_usd          numeric(10,4),
  tokens            int,
  started_at        timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz not null default now()
);

create index scan_runs_brand_created_idx on public.scan_runs (brand_id, created_at desc);
create index scan_runs_status_idx on public.scan_runs (status);
-- At most one non-terminal run per brand row → idempotent enqueue.
create unique index scan_runs_one_inflight_idx
  on public.scan_runs (brand_id)
  where status in ('pending', 'running');

alter table public.scan_runs enable row level security;
-- Same posture as 0006: members read their rows via is_brand_member; all writes
-- go through the service-role scan runner.
create policy "Members read their scan runs"
  on public.scan_runs for select to authenticated
  using (public.is_brand_member(brand_id));
grant select on public.scan_runs to authenticated;
grant all on public.scan_runs to service_role;

-- ── scans: link each result to its run + snapshot the question text ───────────
-- scans is already append-only and carries prompt_id + model. run_id groups a
-- run's rows; prompt_text is the immutable snapshot of the question actually run,
-- so a later in-place prompt edit never re-labels past results (trends match on
-- prompt_text — reset-on-edit). Both nullable: pre-0012 rows have neither. run_id
-- is ON DELETE SET NULL so results survive even if a run row were ever removed.
alter table public.scans
  add column if not exists run_id      uuid references public.scan_runs (id) on delete set null,
  add column if not exists prompt_text text;
create index if not exists scans_run_idx on public.scans (run_id);

-- ── brands: scheduling ────────────────────────────────────────────────────────
-- last_scan_at anchors the daily-sweep due check (due = older than ~24h, or null).
-- is_active lets a row be paused (Epic 5 downgrade) without deleting it or history.
alter table public.brands
  add column if not exists last_scan_at timestamptz,
  add column if not exists is_active    boolean not null default true;

commit;

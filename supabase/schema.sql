-- Agent-led Growth — consolidated database schema
--
-- Run once against a fresh Supabase project (SQL Editor, or: psql <conn> -f this)
-- to create every table, RLS policy, and function the app needs.
--
-- This is a consolidated snapshot for one-shot setup of a fresh database. The
-- incremental migration history stays in supabase/migrations/ (the record of how
-- the schema evolved). This file was verified 1:1 against the live production
-- schema:
--   * 11 tables: ai_search_sites, brand_users, brands, citations, competitors,
--     mentions, prompts, scan_runs, scans, topics, users
--   * their RLS policies (read-scoped via is_brand_member; writes go through the
--     service-role client)
--   * functions: due_brands_for_scan, is_brand_member, rls_auto_enable
--   * the ensure_rls event trigger (auto-enables RLS on new public tables)
--
-- To regenerate from a live database:
--   supabase db dump --schema public -f supabase/schema.sql


-- ===== 0003_unify_users.sql =====
-- Unify the newsletter list and app accounts into a single people table.
--
-- There is only one kind of person: someone who gave us their email. A row is
-- created either by the newsletter subscribe form (status 'pending', confirmed
-- via a magic-link token) or by email-OTP sign-in (which links the Supabase
-- Auth user and sets status 'confirmed'). Both paths key on the normalised
-- email, so the same address is always the same row.
--
-- Supersedes 0001_subscribers.sql and 0002_users.sql. Safe to run on the
-- current project — there is no production data to preserve yet.

drop table if exists public.subscribers;
drop table if exists public.users;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  -- Set once the person completes email-OTP sign-in; null for subscribe-only
  -- rows. Unique so one auth user maps to exactly one row. ON DELETE SET NULL:
  -- deleting the auth user unlinks the row but keeps them on the list.
  auth_user_id uuid unique references auth.users (id) on delete set null,
  email text not null,
  -- Lowercased/trimmed email backing the uniqueness constraint, so Foo@x.com
  -- and foo@x.com are the same person.
  email_normalized text not null generated always as (lower(trim(email))) stored,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'unsubscribed')),
  source text,
  -- Opaque token for the newsletter confirm / unsubscribe links.
  token uuid not null default gen_random_uuid(),
  -- Null until the one-time welcome email has been sent. Claimed atomically by
  -- the OTP verify route so a re-login never re-sends it.
  welcome_email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create unique index users_email_normalized_key on public.users (email_normalized);
create index users_token_idx on public.users (token);
create index users_auth_user_id_idx on public.users (auth_user_id);

-- RLS on. anon gets nothing. A signed-in user may read only their own row
-- (matched by the linked auth user). All writes go through the service-role
-- client in the API routes, which bypasses RLS.
alter table public.users enable row level security;

create policy "Users can read own profile"
  on public.users
  for select
  to authenticated
  using ((select auth.uid()) = auth_user_id);

-- "Automatically expose new tables" is off, so NO privileges are granted on new
-- tables automatically — not even to service_role. Grant them explicitly:
--   - authenticated: SELECT, gated further by the RLS policy above (account page).
--   - service_role: full access for the API routes' writes (it bypasses RLS but
--     still needs table privileges). This is what Supabase grants by default
--     when auto-expose is on; we do it by hand here.
grant select on public.users to authenticated;
grant all on public.users to service_role;


-- ===== 0004_ai_search_sites.sql =====
-- Links an AI Search Monitor user to the site they want monitored, plus the
-- optional description and the topics they selected during onboarding. One row
-- per user for now (the latest); this table will grow as the real tool is built
-- (e.g. generated prompts). Populated by the OTP verify route (ai-search source).
--
-- Onboarding automations are still gated by public.users.welcome_email_sent_at:
-- a user joins only their first automation ever (landing or ai-search), so no
-- separate flag is needed here.

create table if not exists public.ai_search_sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  website text not null,
  description text,
  -- Selected onboarding topics; variable length (not capped at 3).
  topics text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- RLS on; writes go through the service-role client in the verify route. No
-- client policy yet — nothing reads this client-side until the real tool exists
-- (same as subscribers). Add a self-read policy then.
alter table public.ai_search_sites enable row level security;

-- "Auto-expose new tables" is off, so grant explicitly (service_role only).
grant all on public.ai_search_sites to service_role;


-- ===== 0005_laurel_brands.sql =====
-- Laurel data model, part 1: the brand-owned tables written during the
-- pre-scan -> onboarding -> gate flow (brands, membership, topics, prompts).
-- Part 2 (scans / competitors / mentions / citations) is 0006. See
-- laurel-schema.md (v1.2) for the full design.
--
-- Additive on purpose: this does NOT drop public.ai_search_sites. The current
-- OTP verify route and hasScanned() still use it; that table is dropped in the
-- migration that ships alongside the code cutover to brands, not here.
--
-- Wrapped in a transaction: run the whole file at once. If any statement fails,
-- the whole migration rolls back so you can fix and re-paste cleanly.

begin;

-- ── brands ──────────────────────────────────────────────────────────────────
-- The monitored site. Created at pre-scan (website submit) as 'anonymous',
-- before any account. Enrichment backfills name/description/logo. Claimed at the
-- gate, flipping to 'active'. domain is deliberately NOT unique: one brand per
-- signup, so the same domain can appear on many rows.
create table public.brands (
  id                      uuid primary key default gen_random_uuid(),
  domain                  text not null,
  name                    text,
  description             text,
  logo_url                text,
  status                  text not null default 'anonymous'
                            check (status in ('anonymous', 'active')),
  -- null while the first real scan is in flight, set once results exist. Drives
  -- the dashboard's scanning-vs-results state.
  first_scan_completed_at timestamptz,
  created_at              timestamptz not null default now(),
  claimed_at              timestamptz
);

create index brands_domain_idx on public.brands (domain);
create index brands_status_idx on public.brands (status);

-- ── brand_users ─────────────────────────────────────────────────────────────
-- Links public.users (the existing unified people table, see 0003) to a brand.
-- A join table because seats are unlimited: a brand can have several users and a
-- user can hold several brands. In v1 only the claimer is attached; more members
-- arrive via a teammate invite later.
create table public.brand_users (
  brand_id  uuid not null references public.brands (id) on delete cascade,
  user_id   uuid not null references public.users (id) on delete cascade,
  role      text not null default 'owner',
  primary key (brand_id, user_id)
);

create index brand_users_user_id_idx on public.brand_users (user_id);

-- ── topics ──────────────────────────────────────────────────────────────────
-- Buckets suggested at pre-scan. User picks up to 3 in v1, and can add / rename
-- / delete them after the gate.
create table public.topics (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references public.brands (id) on delete cascade,
  label       text not null,
  selected    boolean not null default false,
  sort_order  int,
  created_at  timestamptz not null default now()
);

create index topics_brand_id_idx on public.topics (brand_id);

-- ── prompts ─────────────────────────────────────────────────────────────────
-- The questions fired at the models. Generated from selected topics at the gate,
-- then fully editable. topic_id ON DELETE SET NULL routes prompts to an
-- "Ungrouped" bucket when their topic is deleted, keeping their scan history.
create table public.prompts (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references public.brands (id) on delete cascade,
  topic_id    uuid references public.topics (id) on delete set null,
  text        text not null,
  active      boolean not null default true,   -- soft on/off without deleting history
  sort_order  int,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index prompts_brand_id_idx on public.prompts (brand_id);
create index prompts_topic_id_idx on public.prompts (topic_id);

-- ── ownership helper ────────────────────────────────────────────────────────
-- True when the current session's auth user is a member of brand b. SECURITY
-- DEFINER so it reads brand_users/users as owner, bypassing their RLS — this is
-- what lets the per-table policies below call it without recursing. Every
-- brand-scoped read policy (here and in 0006) resolves ownership through this.
create or replace function public.is_brand_member(b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.brand_users bu
    join public.users u on u.id = bu.user_id
    where bu.brand_id = b
      and u.auth_user_id = (select auth.uid())
  );
$$;

grant execute on function public.is_brand_member(uuid) to authenticated;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Same posture as the rest of the project: anon gets nothing, a signed-in user
-- may read only rows for brands they belong to, and ALL writes go through the
-- service-role client in server routes (which bypasses RLS). No client
-- insert/update/delete policies yet. "Auto-expose new tables" is off, so table
-- privileges are granted by hand: SELECT to authenticated (further gated by the
-- policy) and full access to service_role.

alter table public.brands enable row level security;
create policy "Members read their brands"
  on public.brands for select to authenticated
  using (public.is_brand_member(id));
grant select on public.brands to authenticated;
grant all on public.brands to service_role;

alter table public.brand_users enable row level security;
create policy "Members read brand membership"
  on public.brand_users for select to authenticated
  using (public.is_brand_member(brand_id));
grant select on public.brand_users to authenticated;
grant all on public.brand_users to service_role;

alter table public.topics enable row level security;
create policy "Members read their topics"
  on public.topics for select to authenticated
  using (public.is_brand_member(brand_id));
grant select on public.topics to authenticated;
grant all on public.topics to service_role;

alter table public.prompts enable row level security;
create policy "Members read their prompts"
  on public.prompts for select to authenticated
  using (public.is_brand_member(brand_id));
grant select on public.prompts to authenticated;
grant all on public.prompts to service_role;

commit;


-- ===== 0006_laurel_scans.sql =====
-- Laurel data model, part 2: the scan-output tables. Nothing writes these yet —
-- the scan runner (OpenAI Responses API) and the brand-extraction that populate
-- them are a later phase. Defined now so the schema is whole and RLS is in place
-- from day one. Depends on 0005 (brands, prompts, is_brand_member). See
-- laurel-schema.md (v1.2).
--
-- Wrapped in a transaction: run the whole file at once; any failure rolls the
-- migration back. Run 0005 first — this depends on brands, prompts, and
-- is_brand_member.

begin;

-- ── scans ───────────────────────────────────────────────────────────────────
-- Append-only history. One row per prompt, per platform, per run — the source
-- of every trend line. Never updated, only inserted.
create table public.scans (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references public.brands (id) on delete cascade,
  -- ON DELETE NO ACTION, not cascade: a prompt can't be hard-deleted out from
  -- under its scan history (retire via prompts.active = false). A whole-brand
  -- delete still cascades scans via brand_id.
  prompt_id    uuid not null references public.prompts (id) on delete no action,
  platform     text not null,                   -- 'chatgpt' now, 'claude' later
  model        text not null,                   -- exact model string used
  run_at       timestamptz not null default now(),
  answer_text  text,                            -- raw answer, stored verbatim
  raw          jsonb,                           -- full API response for reprocessing
  created_at   timestamptz not null default now()
);

create index scans_prompt_platform_run_idx on public.scans (prompt_id, platform, run_at desc);
create index scans_brand_run_idx on public.scans (brand_id, run_at desc);
create index scans_platform_idx on public.scans (platform);

-- ── competitors ─────────────────────────────────────────────────────────────
-- Discovered from answers, not the crawl. Upserted as new (already-canonical)
-- names appear. domain/logo_url enriched later. hidden is the only removal path;
-- rows are never hard-deleted so mention history stays intact.
create table public.competitors (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references public.brands (id) on delete cascade,
  name          text not null,                   -- canonical display name
  domain        text,                            -- enriched later, nullable
  logo_url      text,                            -- enriched later, nullable
  hidden        boolean not null default false,  -- user can hide a false positive
  first_seen_at timestamptz not null default now()
);

-- The upsert key: (brand_id, lower(name)). Assumes the name is already canonical
-- (the extractor resolves "Peec" / "Peec AI" / "peec.ai" before insert).
create unique index competitors_brand_name_idx on public.competitors (brand_id, lower(name));
create index competitors_brand_id_idx on public.competitors (brand_id);

-- ── mentions ────────────────────────────────────────────────────────────────
-- One row per brand actually named in an answer, including you (is_self). No row
-- means the brand did not appear — absence is never a row with a null position.
create table public.mentions (
  id             uuid primary key default gen_random_uuid(),
  scan_id        uuid not null references public.scans (id) on delete cascade,
  brand_id       uuid not null references public.brands (id) on delete cascade,  -- owner context
  -- ON DELETE NO ACTION so a competitor can't be deleted out from under its
  -- mention history; a whole-brand delete still clears mentions via brand_id.
  competitor_id  uuid references public.competitors (id) on delete no action,
  is_self        boolean not null default false,
  mentioned_name text not null,                   -- raw string as it appeared
  position       int,                             -- rank among named brands; see constraint
  platform       text not null,                   -- denormalised from scan
  created_at     timestamptz not null default now()
);

-- Enforce the self-mention guarantee at the DB level: if it's you, you have a
-- rank. Competitors may still be null (named in prose without a clean order).
alter table public.mentions add constraint self_mention_has_position
  check (not is_self or position is not null);

create index mentions_scan_idx on public.mentions (scan_id);
create index mentions_brand_platform_idx on public.mentions (brand_id, platform);
create index mentions_competitor_idx on public.mentions (competitor_id);

-- ── citations ───────────────────────────────────────────────────────────────
-- One row per source cited in a scan. Distinct from mentions: citations are the
-- URLs the answer drew on; mentions are the brands it named.
create table public.citations (
  id            uuid primary key default gen_random_uuid(),
  scan_id       uuid not null references public.scans (id) on delete cascade,
  brand_id      uuid not null references public.brands (id) on delete cascade,  -- owner context
  platform      text not null,                   -- denormalised from scan
  url           text not null,
  domain        text not null,                   -- extracted host, for citation-share
  title         text,
  is_own_domain boolean not null default false,  -- is this the brand's own site
  position      int,                             -- order the source appeared, if available
  created_at    timestamptz not null default now()
);

create index citations_scan_idx on public.citations (scan_id);
create index citations_brand_domain_idx on public.citations (brand_id, domain);
create index citations_platform_idx on public.citations (platform);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Same posture as 0005: members read only their brand's rows (via
-- is_brand_member), all writes go through the service-role scan runner.

alter table public.scans enable row level security;
create policy "Members read their scans"
  on public.scans for select to authenticated
  using (public.is_brand_member(brand_id));
grant select on public.scans to authenticated;
grant all on public.scans to service_role;

alter table public.competitors enable row level security;
create policy "Members read their competitors"
  on public.competitors for select to authenticated
  using (public.is_brand_member(brand_id));
grant select on public.competitors to authenticated;
grant all on public.competitors to service_role;

alter table public.mentions enable row level security;
create policy "Members read their mentions"
  on public.mentions for select to authenticated
  using (public.is_brand_member(brand_id));
grant select on public.mentions to authenticated;
grant all on public.mentions to service_role;

alter table public.citations enable row level security;
create policy "Members read their citations"
  on public.citations for select to authenticated
  using (public.is_brand_member(brand_id));
grant select on public.citations to authenticated;
grant all on public.citations to service_role;

commit;


-- ===== 0007_scan_status.sql =====
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


-- ===== 0008_scan_lock.sql =====
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


-- ===== 0009_scan_error.sql =====
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


-- ===== 0010_scan_failed.sql =====
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


-- ===== 0011_user_plan.sql =====
-- User plan tier. A plain string identifier (not a boolean) so new paid tiers
-- are just new values — no future migration. 'free' is the default; a user is
-- flipped to 'paid' (and, later, other tiers) manually for now, and by the
-- Stripe webhook once billing is integrated. No CHECK constraint on purpose, so
-- adding a tier never needs a schema change. What each plan grants lives in code
-- (PLAN_FEATURES), not here. Depends on 0003 (users).
--
-- Wrapped in a transaction: run the whole file at once; any failure rolls back.

begin;

alter table public.users
  add column if not exists plan text not null default 'free';

comment on column public.users.plan is
  'Plan tier identifier (free | paid | …future tiers). Capabilities per plan live '
  'in code, not here. Set manually for now; by the Stripe webhook once billing lands.';

commit;


-- ===== 0012_scan_runs.sql =====
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


-- ===== 0013_due_brands_for_scan.sql =====
-- Daily-sweep due-brands query (Epic 4, slice 3). Returns brand rows that are
-- active, have NO in-flight run, and have NO completed run since `stale_before`
-- (i.e. due for a scan), plus the owner's plan so the caller decides "is this a
-- daily plan?" in code (fail-closed via planOf/isDaily), never in SQL.
--
-- Due is anchored on the last COMPLETED run (not brands.last_scan_at), so a
-- best-effort missed last_scan_at stamp can never cause a re-scan.
--
-- Depends on 0005 (brands, brand_users, users), 0012 (scan_runs). Read-only.

begin;

create or replace function public.due_brands_for_scan(stale_before timestamptz)
returns table (brand_id uuid, plan text)
language sql
stable
as $$
  with due as (
    -- One row per brand: prefer the 'owner' member, else any member, so a brand
    -- with only non-owner members is never silently skipped. distinct on requires
    -- brand_id first in the order by.
    select distinct on (b.id)
      b.id as brand_id, u.plan, b.last_scan_at
    from public.brands b
    join public.brand_users bu on bu.brand_id = b.id
    join public.users u on u.id = bu.user_id
    where b.is_active
      -- Coarse pre-filter: free never scans on a schedule, so drop it in SQL
      -- rather than returning every free brand for the caller to discard. The
      -- authoritative daily/free decision still happens in code (isDaily),
      -- fail-closed for any unrecognised plan value.
      and u.plan is distinct from 'free'
      and not exists (
        select 1 from public.scan_runs r
        where r.brand_id = b.id and r.status in ('pending', 'running')
      )
      and not exists (
        select 1 from public.scan_runs r
        where r.brand_id = b.id
          and r.status = 'completed'
          and r.completed_at > stale_before
      )
    order by b.id, (bu.role = 'owner') desc
  )
  -- Most overdue first (never-scanned, then oldest last_scan_at) so a per-tick
  -- cap is fair — last_scan_at is only an ordering hint, never the due check.
  select brand_id, plan from due
  order by last_scan_at asc nulls first;
$$;

-- Called only by the service-role scan sweep (never a browser); the anon role
-- must not be able to enumerate brands.
revoke all on function public.due_brands_for_scan(timestamptz) from public;
grant execute on function public.due_brands_for_scan(timestamptz) to service_role;

commit;


-- ===== 0014_run_id_mentions_citations.sql =====
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


-- ===== 0015_backfill_legacy_runs.sql =====
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


-- ===== 0016_stripe_billing.sql =====
-- Stripe billing mirror (Epic 6). Stripe is the source of truth for subscription
-- state; we mirror just enough onto public.users to gate features and show the
-- account's plan without ever calling Stripe on a request. The webhook writes
-- these columns (service-role, RLS-bypassing); the user only ever reads its own
-- row via the existing "read own profile" policy from 0003.
--
-- `users.plan` (0011) stays the single gate the app reads; these columns are the
-- provenance behind it. On checkout/subscription events the webhook maps the
-- Stripe price id -> plan and sets `plan` here in the same write, so a bad or
-- missing mirror never silently grants access — the code still fails closed on
-- `plan` via planOf().
--
-- Depends on 0003 (users), 0011 (users.plan).
-- Wrapped in a transaction: run the whole file at once; any failure rolls back.

begin;

alter table public.users
  -- Stripe Customer for this account. Created lazily at first checkout and reused
  -- for every later checkout / portal session. Unique so one customer maps to one
  -- account; the webhook resolves the account by this when an event carries only
  -- the customer (subscription.updated/deleted, invoice.payment_failed).
  add column if not exists stripe_customer_id      text,
  -- The active subscription and the price it is on. `stripe_price_id` is what maps
  -- back to a plan/interval via the code-side price map.
  add column if not exists stripe_subscription_id  text,
  add column if not exists stripe_price_id          text,
  -- Mirror of the Stripe subscription status (active | trialing | past_due |
  -- canceled | ...). The app gates on `plan`, not this; it is for display and for
  -- deciding, in the webhook, whether to drop the account back to free.
  add column if not exists plan_status              text,
  -- End of the current paid period, and whether the subscription is set to cancel
  -- at that boundary — both surfaced in the Account view.
  add column if not exists current_period_end       timestamptz,
  add column if not exists cancel_at_period_end     boolean not null default false;

-- The webhook looks accounts up by Stripe customer id on events that don't carry
-- our client_reference_id. Partial + unique: at most one account per customer,
-- and null (not-yet-a-customer) rows are exempt from the uniqueness.
create unique index if not exists users_stripe_customer_id_key
  on public.users (stripe_customer_id)
  where stripe_customer_id is not null;

comment on column public.users.stripe_customer_id is
  'Stripe Customer id for this account (lazily created at first checkout). The '
  'webhook resolves the account by this for customer-only events.';
comment on column public.users.plan_status is
  'Mirror of the Stripe subscription status; display only. The app gates on '
  'users.plan, which the webhook sets from the price id.';

commit;


-- ===== 0017_brand_location.sql =====
-- Location targeting for AI Search (Epic: geo scope). A brand can be measured
-- worldwide (the default, unchanged) or scoped to a specific country or city, so
-- its visibility numbers reflect the market it actually sells in rather than a
-- globally-averaged blur. The scope steers OpenAI's web_search `user_location`
-- and biases prompt wording; worldwide brands keep today's exact behaviour.
--
-- Depends on 0005 (brands). Column-only add — no RLS change, since the existing
-- is_brand_member policy already covers new columns.
-- Wrapped in a transaction: run the whole file at once; any failure rolls back.

begin;

alter table public.brands
  -- The scope mode. 'worldwide' (default) leaves measurement untouched.
  add column if not exists location_mode text not null default 'worldwide'
    check (location_mode in ('worldwide', 'country', 'city')),
  -- ISO-3166 alpha-2, uppercase. Null when worldwide.
  add column if not exists location_country text,
  -- City display name (GeoNames). Null unless location_mode = 'city'.
  add column if not exists location_city text,
  -- Human display label, e.g. 'Germany' or 'Berlin, Germany'. Null when worldwide.
  add column if not exists location_label text;

commit;


-- ===== rls_auto_enable — present in the live DB, not in the migrations =====
-- Belt-and-suspenders security: an event trigger that auto-enables Row Level
-- Security on any table subsequently created in `public`, so a new table can
-- never ship without RLS. Complements the explicit `enable row level security`
-- statements above. Requires the elevated privileges the Supabase `postgres`
-- role has (creating an event trigger); harmless to skip on a plain Postgres
-- that forbids it, since every app table already has RLS enabled explicitly.
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

DROP EVENT TRIGGER IF EXISTS ensure_rls;
CREATE EVENT TRIGGER ensure_rls ON ddl_command_end
  EXECUTE FUNCTION public.rls_auto_enable();

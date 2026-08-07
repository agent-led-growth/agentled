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

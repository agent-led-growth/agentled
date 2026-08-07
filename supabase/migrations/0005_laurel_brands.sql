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

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

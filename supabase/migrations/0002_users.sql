-- App users for Agent-led Growth.
--
-- One row per verified account, keyed to the Supabase Auth user (auth.users).
-- The row is created by the OTP verify route after a successful email
-- verification, so a row here always means "this email was proven to work".
-- auth.users still holds the canonical email; this table is the app-owned
-- profile we read from the account page and extend later.

create table if not exists public.users (
  -- Same id as the Supabase Auth user. Cascade so deleting the auth user
  -- cleans up the profile automatically.
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  -- Null until the one-time welcome email has been sent. The verify route
  -- claims this column atomically (update ... where welcome_email_sent_at is
  -- null) so signing in again never re-sends the welcome.
  welcome_email_sent_at timestamptz
);

-- RLS on. The anon role gets no access at all. A signed-in user may read only
-- their own row; the account page reads through the request-scoped server
-- client, which carries the user's session and so is subject to this policy.
-- There is deliberately no client insert/update/delete policy: every write goes
-- through the service-role client in the verify route, which bypasses RLS.
alter table public.users enable row level security;

create policy "Users can read own profile"
  on public.users
  for select
  to authenticated
  -- (select auth.uid()) rather than auth.uid() so the planner evaluates it once
  -- per query instead of once per row — Supabase's recommended RLS form.
  using ((select auth.uid()) = id);

-- The Data API's "automatically expose new tables" is off, so table privileges
-- are granted by hand. This makes public.users reachable through the API for the
-- authenticated role (the account page reads it); the RLS policy above still
-- decides which rows that role can see. service_role (the admin client used for
-- all writes) already has privileges via Supabase's default grants, like the
-- subscribers table.
grant select on public.users to authenticated;

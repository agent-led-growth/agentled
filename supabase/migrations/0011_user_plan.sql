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

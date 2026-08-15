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

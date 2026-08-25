import type Stripe from "stripe";

import {
  notifyChurn,
  notifyPaidConversion,
  notifyPaymentFailed,
} from "@/lib/email/billing";
import type { Plan } from "@/lib/plan";
import { createAdminClient } from "@/lib/supabase/admin";

import { stripe } from "./client";
import { planForPriceId } from "./prices";

/**
 * Server-only billing data-access: the bridge between Stripe events and our
 * `public.users` mirror (0016). Every write is service-role (RLS-bypassing); the
 * user only ever reads its own row. Keep the Stripe-object → column mapping here
 * so the routes stay thin.
 */

/** Subscription statuses that still grant plan access (Stripe retries past_due). */
const ACCESS_STATUSES = new Set(["active", "trialing", "past_due"]);

/** The billing-relevant slice of an account, keyed from a Supabase Auth user. */
export interface BillingProfile {
  /** public.users id — used as Stripe `client_reference_id`. */
  userId: string;
  email: string;
  /** Null until the first checkout creates/links a Stripe customer. */
  stripeCustomerId: string | null;
  /** The active subscription id, if any (null before the first checkout). */
  stripeSubscriptionId: string | null;
  /** Mirrored Stripe subscription status (active | past_due | canceled | …). */
  planStatus: string | null;
}

/** Resolve the billing profile for a signed-in auth user, or null if no row. */
export async function getBillingProfile(
  authUserId: string,
): Promise<BillingProfile | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id, email, stripe_customer_id, stripe_subscription_id, plan_status")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as {
    id: string;
    email: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    plan_status: string | null;
  };
  return {
    userId: row.id,
    email: row.email,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    planStatus: row.plan_status,
  };
}

/**
 * Whether the account already has a live Stripe subscription — used to route an
 * existing subscriber to the Customer Portal (to switch plan) instead of starting
 * a second, parallel Checkout Session that would double-bill them.
 */
export function hasActiveSubscription(profile: BillingProfile): boolean {
  return (
    profile.stripeSubscriptionId !== null &&
    profile.planStatus !== null &&
    ACCESS_STATUSES.has(profile.planStatus)
  );
}

/**
 * Authoritative check for a live subscription, asking Stripe directly rather than
 * the eventually-consistent mirror. Closes the window where a first checkout has
 * completed but its webhook hasn't landed yet: {@link hasActiveSubscription} would
 * still read `free`, so a second checkout could double-subscribe. Only called when
 * the cheap mirror check is negative, so the extra API hit is off the hot path.
 */
export async function hasLiveSubscription(customerId: string): Promise<boolean> {
  // Default list excludes canceled/incomplete_expired; filter to access-granting
  // so an abandoned `incomplete` subscription doesn't wall a legitimate checkout.
  const subs = await stripe().subscriptions.list({ customer: customerId, limit: 10 });
  return subs.data.some((s) => ACCESS_STATUSES.has(s.status));
}

/**
 * Persist the Stripe customer id on an account (first checkout). Idempotent: only
 * writes rows that don't already carry a customer id, so a race can't clobber an
 * existing link.
 */
export async function linkStripeCustomer(
  userId: string,
  customerId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ stripe_customer_id: customerId })
    .eq("id", userId)
    .is("stripe_customer_id", null);
  if (error) throw error;
}

/** Read the current-period end (unix seconds) across Stripe API-version shapes. */
function periodEndSeconds(sub: Stripe.Subscription): number | null {
  const top = (sub as unknown as { current_period_end?: number }).current_period_end;
  if (typeof top === "number") return top;
  // Newer API versions moved the period onto the subscription item.
  const item = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined;
  return typeof item?.current_period_end === "number" ? item.current_period_end : null;
}

/**
 * Mirror a Stripe subscription onto its account and set the gated `users.plan`
 * from the subscription's price. This is the one place plan access is granted or
 * revoked from billing:
 *
 * - Access-granting status (active/trialing/past_due) + a known price → that plan.
 * - Anything else (canceled/unpaid/incomplete/unknown price) → `free`, fail-closed.
 *
 * Resolves the account by the subscription's customer id; a no-op (returns false)
 * if no account matches — e.g. an event for a customer we never linked.
 */
export async function syncSubscription(sub: Stripe.Subscription): Promise<boolean> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const admin = createAdminClient();

  // Read the pre-update state so we can fire internal alerts only on real plan
  // transitions (free→paid, paid→free) — not on renewals or redelivered events.
  const { data: before, error: beforeErr } = await admin
    .from("users")
    .select("id, email, plan")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (beforeErr) throw beforeErr;
  if (!before) return false;
  const prev = before as { id: string; email: string; plan: Plan | null };
  const userId = prev.id;

  const priceId = sub.items?.data?.[0]?.price?.id ?? null;
  const mapped = planForPriceId(priceId);
  const statusGrantsAccess = ACCESS_STATUSES.has(sub.status);
  // A charged, access-granting subscription whose price we can't map is almost
  // always a missing/typo'd STRIPE_PRICE_* env — fail closed to free, but log
  // loudly so the misconfiguration is caught instead of silently downgrading a
  // paying customer.
  if (statusGrantsAccess && mapped === null) {
    console.error(
      `stripe: subscription ${sub.id} is '${sub.status}' but price ${priceId} maps to no plan — check STRIPE_PRICE_* env. Falling back to free.`,
    );
  }
  const grantsAccess = statusGrantsAccess && mapped !== null;
  const plan: Plan = grantsAccess ? mapped!.plan : "free";
  const periodEnd = periodEndSeconds(sub);

  const { error } = await admin
    .from("users")
    .update({
      plan,
      stripe_subscription_id: sub.id,
      stripe_price_id: priceId,
      plan_status: sub.status,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
    })
    .eq("id", userId);
  if (error) throw error;

  // Internal, admin-only alerts (never sent to the customer). Best-effort, so a
  // mail failure can't fail the sync. Duplicate paid alerts are acceptable — a
  // concurrent checkout.session.completed + subscription.created can both observe
  // the free→paid edge; the alert only goes to us, so an occasional double is fine.
  //
  // Churn keys off the subscription *status* (statusGrantsAccess), not grantsAccess:
  // an access-granting status whose price simply doesn't map (env misconfig, logged
  // above) is a config error, not a cancellation, and must not masquerade as churn.
  // Guard on email so a missing address never renders as the literal "null".
  const wasPaid = prev.plan !== null && prev.plan !== "free";
  if (prev.email) {
    if (!wasPaid && grantsAccess) {
      await notifyPaidConversion(prev.email, plan);
    } else if (wasPaid && !statusGrantsAccess) {
      await notifyChurn(prev.email, prev.plan!);
    }
  }

  return true;
}

/**
 * Flag a failed payment without yanking access: record `past_due` so the Account
 * view can warn, but leave `users.plan` intact — Stripe retries, and only an
 * actual subscription cancellation (via {@link syncSubscription}) drops the plan.
 * The webhook still prefers re-syncing the subscription when the event carries it;
 * this is the minimal fallback.
 */
export async function markPaymentFailed(
  customerId: string,
  opts: { firstFailure?: boolean } = {},
): Promise<void> {
  const admin = createAdminClient();
  const { data, error: selErr } = await admin
    .from("users")
    .select("id, email")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (selErr) throw selErr;
  if (!data) return;
  const row = data as { id: string; email: string };

  const { error } = await admin
    .from("users")
    .update({ plan_status: "past_due" })
    .eq("id", row.id);
  if (error) throw error;

  // Internal, admin-only alert. Fire on the invoice's first failed attempt only
  // (the caller derives this from invoice.attempt_count), NOT on our plan_status
  // mirror: syncSubscription also writes past_due from a concurrent
  // customer.subscription.updated event, so a mirror-based guard would swallow the
  // alert whenever that event happens to be processed first. Guard on email +
  // best-effort so a mail failure can't fail the webhook.
  if (opts.firstFailure && row.email) {
    await notifyPaymentFailed(row.email);
  }
}

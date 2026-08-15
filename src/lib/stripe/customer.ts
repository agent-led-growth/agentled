import type Stripe from "stripe";

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

/** Find the account that owns a Stripe customer id, or null. */
export async function findUserIdByCustomerId(
  customerId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (error) throw error;
  return data ? (data as { id: string }).id : null;
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
  const userId = await findUserIdByCustomerId(customerId);
  if (!userId) return false;

  const priceId = sub.items?.data?.[0]?.price?.id ?? null;
  const mapped = planForPriceId(priceId);
  // A charged, access-granting subscription whose price we can't map is almost
  // always a missing/typo'd STRIPE_PRICE_* env — fail closed to free, but log
  // loudly so the misconfiguration is caught instead of silently downgrading a
  // paying customer.
  if (ACCESS_STATUSES.has(sub.status) && mapped === null) {
    console.error(
      `stripe: subscription ${sub.id} is '${sub.status}' but price ${priceId} maps to no plan — check STRIPE_PRICE_* env. Falling back to free.`,
    );
  }
  const grantsAccess = ACCESS_STATUSES.has(sub.status) && mapped !== null;
  const plan: Plan = grantsAccess ? mapped!.plan : "free";
  const periodEnd = periodEndSeconds(sub);

  const admin = createAdminClient();
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
  return true;
}

/**
 * Flag a failed payment without yanking access: record `past_due` so the Account
 * view can warn, but leave `users.plan` intact — Stripe retries, and only an
 * actual subscription cancellation (via {@link syncSubscription}) drops the plan.
 * The webhook still prefers re-syncing the subscription when the event carries it;
 * this is the minimal fallback.
 */
export async function markPaymentFailed(customerId: string): Promise<void> {
  const userId = await findUserIdByCustomerId(customerId);
  if (!userId) return;
  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ plan_status: "past_due" })
    .eq("id", userId);
  if (error) throw error;
}

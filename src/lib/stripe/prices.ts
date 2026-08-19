import { env } from "@/lib/env";
import { isPaidPlan, type Interval } from "@/lib/pricing";
import type { Plan } from "@/lib/plan";

/**
 * The Stripe price ids for the paid plans, and the reverse map from a price id
 * back to the plan/interval it represents. Everything is env-driven
 * (`STRIPE_PRICE_<PLAN>_<INTERVAL>`) so switching the local $0.10 test prices for
 * the real live prices is a config change, never code.
 *
 * `free` has no price, so there are six ids: starter/pro/business × monthly/yearly.
 * Resolved lazily (env is read on call, not at import) and validated so a
 * mis-set or missing id fails loudly at the checkout/webhook call site instead of
 * silently charging the wrong plan.
 */
type PaidPlan = Exclude<Plan, "free" | "unlimited">;

const PAID_PLANS: readonly PaidPlan[] = ["starter", "pro", "business"];
const INTERVALS: readonly Interval[] = ["monthly", "yearly"];

/** Env var suffix for a (plan, interval), e.g. ("pro","yearly") -> "PRO_YEARLY". */
function envKey(plan: PaidPlan, interval: Interval): string {
  return `${plan.toUpperCase()}_${interval.toUpperCase()}`;
}

/**
 * The Stripe price id for a plan + interval. Throws on `free` (no price) or a
 * missing env value — a checkout must never fall back to a wrong/blank price.
 */
export function priceIdFor(plan: Plan, interval: Interval): string {
  if (!isPaidPlan(plan)) {
    throw new Error(`No Stripe price for non-purchasable plan "${plan}"`);
  }
  const id = env.stripePriceId(envKey(plan, interval));
  if (!id) {
    throw new Error(`Missing Stripe price id: STRIPE_PRICE_${envKey(plan, interval)}`);
  }
  return id;
}

/**
 * Resolve a Stripe price id back to the plan + interval it maps to, or null if it
 * matches none of the configured ids. The webhook uses this to turn the price on a
 * subscription into the plan we store — an unknown price yields null so we never
 * grant a plan we can't account for.
 */
export function planForPriceId(
  priceId: string | null | undefined,
): { plan: PaidPlan; interval: Interval } | null {
  if (!priceId) return null;
  for (const plan of PAID_PLANS) {
    for (const interval of INTERVALS) {
      if (env.stripePriceId(envKey(plan, interval)) === priceId) {
        return { plan, interval };
      }
    }
  }
  return null;
}

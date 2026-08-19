/**
 * Pricing for the paid plans — the money side of {@link file://./plan.ts}.
 * Capabilities (brands/prompts/frequency) live in PLAN_FEATURES; this module is
 * only the prices and display order. Pure and client-safe; localized copy (plan
 * names, taglines, feature bullets) lives in the i18n dictionaries, not here.
 *
 * When Stripe lands (Epic 6) each price maps to a Stripe price id there; these
 * numbers stay the single source for what we show on /pricing.
 */
import type { Plan } from "./plan";

/** Billing interval a customer can choose. */
export type Interval = "monthly" | "yearly";

/** Plans shown on the pricing page, in display order (free first). */
export const PRICING_PLANS = ["free", "starter", "pro", "business"] as const satisfies readonly Plan[];

/** The visually highlighted plan on the pricing grid. */
export const FEATURED_PLAN: Plan = "pro";

/**
 * Yearly is priced at 10× the monthly rate — "12 months for the price of 10",
 * i.e. two months free. Kept as a constant so the saving is derived, never
 * hard-coded per plan.
 */
export const YEARLY_MONTHS = 10;

/**
 * USD prices for the purchasable tiers. `free` and the internal `unlimited`
 * admin tier have no price and are intentionally absent.
 */
export const PLAN_PRICING: Record<
  Exclude<Plan, "free" | "unlimited">,
  { monthly: number; yearly: number }
> = {
  starter: { monthly: 19, yearly: 19 * YEARLY_MONTHS },
  pro: { monthly: 90, yearly: 90 * YEARLY_MONTHS },
  business: { monthly: 270, yearly: 270 * YEARLY_MONTHS },
};

/**
 * True for a plan that carries a purchasable price. `free` and the internal
 * `unlimited` admin grant both have no price and are excluded.
 */
export function isPaidPlan(plan: Plan): plan is Exclude<Plan, "free" | "unlimited"> {
  return plan !== "free" && plan !== "unlimited";
}

/** The price for a plan at an interval, or null for `free`. */
export function priceFor(plan: Plan, interval: Interval): number | null {
  return isPaidPlan(plan) ? PLAN_PRICING[plan][interval] : null;
}

/**
 * Effective monthly cost when billed yearly (annual total ÷ 12), or null for
 * `free`. Display-only — billing still charges the yearly total; this is just
 * what the yearly toggle headlines on /pricing.
 */
export function effectiveMonthly(plan: Plan): number | null {
  return isPaidPlan(plan) ? PLAN_PRICING[plan].yearly / 12 : null;
}

/** Format a USD amount: whole numbers bare, otherwise to two decimals. */
export function formatUsd(amount: number): string {
  return Number.isInteger(amount) ? `${amount}` : amount.toFixed(2);
}

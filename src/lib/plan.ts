/**
 * Account plan tiers. The DB stores which plan a user is on (users.plan, a plain
 * string); this module is the single source of what that identifier means.
 *
 * Fail closed: any value not listed here — a typo, a stale value, or a tier we
 * don't recognise — resolves to `free`, so a bad users.plan can never silently
 * grant paid access. Adding a paid tier is a change here (+ future capabilities),
 * no DB migration and no CHECK constraint needed.
 */
export const PLANS = ["free", "paid"] as const;
export type Plan = (typeof PLANS)[number];

const KNOWN = new Set<string>(PLANS);

/** Resolve a raw users.plan value to a known Plan, defaulting to `free`. */
export function planOf(plan: string | null | undefined): Plan {
  return plan && KNOWN.has(plan) ? (plan as Plan) : "free";
}

/**
 * Whether the plan grants paid access. Whitelist-based, not `!== "free"`, so an
 * unrecognised value counts as free rather than paid. Enforce this server-side —
 * the client's copy of the plan is only for UI.
 */
export function isPaid(plan: string | null | undefined): boolean {
  return planOf(plan) !== "free";
}

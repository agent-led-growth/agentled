/**
 * Account plan tiers and what each grants. `users.plan` stores the tier as a
 * plain string; this module is the single source of what that identifier means.
 *
 * Fail closed: any value not listed here — a typo, a stale value, or a tier we
 * don't recognise — resolves to `free`, so a bad users.plan can never silently
 * grant paid access. Adding a paid tier is a change here (+ its capabilities),
 * no DB migration and no CHECK constraint needed.
 *
 * Pure and client-safe: no server-only imports, so UI can import it for plan
 * copy. Enforcement must still happen server-side — the client's copy of the
 * plan is only for display.
 */
export const PLANS = ["free", "starter", "pro", "business"] as const;
export type Plan = (typeof PLANS)[number];

const KNOWN = new Set<string>(PLANS);

/**
 * Retired plan values, mapped to their nearest current tier so an already-set
 * `users.plan` keeps working. `paid` predates the starter/pro/business split and
 * was a single "has paid access" flag; treat it as `pro` (re-tier specific users
 * by hand if needed). Without this, an old `paid` value would fail closed to free.
 */
const LEGACY: Record<string, Plan> = { paid: "pro" };

/** Scan cadence a plan grants. */
export type Frequency = "one-time" | "daily";

/**
 * AI models a plan may run prompts on. Phase 1 is ChatGPT-only for every tier.
 * This is the home for Phase-2 model gating; the "more models coming soon" on
 * Pro/Business is marketing copy and deliberately NOT encoded here yet.
 */
export type Model = "chatgpt";

/**
 * What a plan grants. Capabilities live here in code, never in the DB. Fields are
 * `readonly` so `planFeatures()` can hand out the shared PLAN_FEATURES entry
 * without a caller mutating it and poisoning every later lookup.
 */
export interface PlanFeatures {
  /** Max brands an account may keep active. */
  readonly brands: number;
  /** Max prompts (questions in Phase 1) across the account's active brand(s). */
  readonly prompts: number;
  /** Scan cadence. */
  readonly frequency: Frequency;
  /** Models prompts run on (ChatGPT-only in Phase 1). */
  readonly models: readonly Model[];
}

export const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  free: { brands: 1, prompts: 9, frequency: "one-time", models: ["chatgpt"] },
  starter: { brands: 1, prompts: 9, frequency: "daily", models: ["chatgpt"] },
  pro: { brands: 1, prompts: 50, frequency: "daily", models: ["chatgpt"] },
  business: { brands: 3, prompts: 150, frequency: "daily", models: ["chatgpt"] },
};

/** Resolve a raw users.plan value to a known Plan, defaulting to `free`. */
export function planOf(plan: string | null | undefined): Plan {
  if (!plan) return "free";
  if (KNOWN.has(plan)) return plan as Plan;
  return LEGACY[plan] ?? "free";
}

/** The capabilities of a (raw or resolved) plan. Fail-closed via {@link planOf}. */
export function planFeatures(plan: string | null | undefined): PlanFeatures {
  return PLAN_FEATURES[planOf(plan)];
}

/**
 * Whether the plan grants any paid tier. Whitelist-based, not `!== "free"`, so an
 * unrecognised value counts as free rather than paid. Enforce this server-side —
 * the client's copy of the plan is only for UI.
 */
export function isPaid(plan: string | null | undefined): boolean {
  return planOf(plan) !== "free";
}

/** Max brands the plan allows per account. */
export function brandLimit(plan: string | null | undefined): number {
  return planFeatures(plan).brands;
}

/** Max prompts (questions in Phase 1) the plan allows. */
export function promptLimit(plan: string | null | undefined): number {
  return planFeatures(plan).prompts;
}

/** Whether the plan gets recurring daily scans (vs. a single one-time scan). */
export function isDaily(plan: string | null | undefined): boolean {
  return planFeatures(plan).frequency === "daily";
}

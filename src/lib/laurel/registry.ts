/**
 * Model/service registry — the single source of truth mapping a Laurel role to
 * a provider + model + tuning. Nothing is hardcoded at the call site; swapping a
 * model is an edit here + a redeploy. Model ids and prices go stale by design.
 */

export type Provider = "openai" | "anthropic";
export type LaurelRole = "enrichment" | "scan" | "extraction";

export interface ModelConfig {
  provider: Provider;
  /**
   * Exact model id. ⚠️ Pin the suffix — the bare `gpt-5.6` alias routes to Sol
   * (the expensive flagship, ~5×). Never shorten these strings.
   */
  model: string;
  /** Responses API reasoning effort. Note: gpt-5.6 models reject "minimal"; the
   * cheapest supported value is "none". */
  reasoningEffort?: "none" | "low" | "medium" | "high" | "xhigh" | "max";
  temperature?: number;
  maxOutputTokens?: number;
}

export const registry: Record<LaurelRole, ModelConfig> = {
  // Steps 2 & 5 (generation). Inferring buyer-intent topics from crawled content
  // is nuanced synthesis, not just extraction — terra over luna earns its keep.
  enrichment: {
    provider: "openai",
    model: "gpt-5.6-terra",
    reasoningEffort: "low",
    maxOutputTokens: 3000,
  },
  // Step 6. Locked to OpenAI (Responses API + web search). Built in the scan
  // phase; a per-call web-search fee dominates cost, so Terra over Luna.
  scan: {
    provider: "openai",
    model: "gpt-5.6-terra",
  },
  // Step 7 (extraction). Deterministic parsing; cheapest effort.
  extraction: {
    provider: "openai",
    model: "gpt-5.6-luna",
    reasoningEffort: "low",
  },
};

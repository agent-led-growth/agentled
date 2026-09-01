/**
 * Model/service registry — the single source of truth mapping an AI Search role to
 * a provider + model + tuning. Nothing is hardcoded at the call site; swapping a
 * model is an edit here + a redeploy. Model ids and prices go stale by design.
 */

export type Provider = "openai" | "anthropic";
export type AiSearchRole = "enrichment" | "scan" | "extraction";

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

export const registry: Record<AiSearchRole, ModelConfig> = {
  // Steps 2 & 5 (generation). Luna for now to keep costs down; was terra for
  // sharper topic quality — revisit if topics/prompts degrade.
  enrichment: {
    provider: "openai",
    model: "gpt-5.6-luna",
    reasoningEffort: "low",
    maxOutputTokens: 3000,
  },
  // Step 6. Locked to OpenAI (Responses API + web search). Luna + low effort to
  // keep both token and per-call cost down.
  scan: {
    provider: "openai",
    model: "gpt-5.6-luna",
    reasoningEffort: "low",
  },
  // Step 7 (extraction). Deterministic parsing; cheapest effort.
  extraction: {
    provider: "openai",
    model: "gpt-5.6-luna",
    reasoningEffort: "low",
  },
};

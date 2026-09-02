import type { Brand, Prompt, PromptAnswer, ScanRun } from "@/lib/ai-search";

/**
 * DB row → public API shape. Deliberately explicit (not a pass-through) so the
 * public contract is camelCase and stable: internal column names can change
 * without breaking the API, and internal-only fields (e.g. scan cost/tokens,
 * a run's user_id) are never exposed.
 */

export function serializeBrand(b: Brand) {
  return {
    id: b.id,
    domain: b.domain,
    name: b.name,
    description: b.description,
    logoUrl: b.logo_url,
    status: b.status,
    isActive: b.is_active,
    firstScanCompletedAt: b.first_scan_completed_at,
    lastScanAt: b.last_scan_at,
    createdAt: b.created_at,
    claimedAt: b.claimed_at,
    location: {
      mode: b.location_mode,
      country: b.location_country,
      city: b.location_city,
      label: b.location_label,
    },
  };
}

export function serializePrompt(p: Prompt) {
  // topic_id is intentionally omitted — topics aren't part of the public API.
  return {
    id: p.id,
    brandId: p.brand_id,
    text: p.text,
    active: p.active,
    sortOrder: p.sort_order,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export function serializeAnswer(a: PromptAnswer) {
  return {
    runId: a.runId,
    at: a.at,
    answer: a.answer,
    promptText: a.promptText,
    named: a.named,
    highlight: a.highlight,
    brands: a.brands,
    cites: a.cites,
  };
}

export function serializeScan(r: ScanRun) {
  return {
    id: r.id,
    brandId: r.brand_id,
    status: r.status,
    trigger: r.trigger,
    model: r.model,
    promptsAttempted: r.prompts_attempted,
    promptsCompleted: r.prompts_completed,
    error: r.error,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    createdAt: r.created_at,
  };
}

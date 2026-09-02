import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import type { NewPrompt, Prompt } from "./types";

/**
 * Prompt writes/reads. Prompts are generated from the selected topics at the
 * gate (generation logic lives with the route / the future intelligence); this
 * module just persists and reads them. Retire a prompt with `active = false`,
 * never a hard delete — its scan history is protected by the FK.
 */

/** Bulk-insert prompts under a brand. `sortOrder` defaults to array index. */
export async function insertPrompts(
  brandId: string,
  prompts: NewPrompt[],
): Promise<Prompt[]> {
  if (prompts.length === 0) return [];

  const admin = createAdminClient();
  const rows = prompts.map((p, i) => ({
    brand_id: brandId,
    topic_id: p.topicId,
    text: p.text,
    sort_order: p.sortOrder ?? i,
  }));
  const { data, error } = await admin.from("prompts").insert(rows).select("*");
  if (error) throw error;
  return (data ?? []) as Prompt[];
}

/**
 * A brand's prompts, ordered by sort order then creation. Returns both active and
 * inactive by default (a "removed" prompt is a soft delete, kept for history);
 * pass `opts.active` to filter, and `opts.limit`/`opts.offset` to paginate. All
 * options are optional so existing callers get every prompt as before.
 */
export async function listPrompts(
  brandId: string,
  opts?: { active?: boolean; limit?: number; offset?: number },
): Promise<Prompt[]> {
  const admin = createAdminClient();
  const filtered =
    opts?.active === undefined
      ? admin.from("prompts").select("*").eq("brand_id", brandId)
      : admin.from("prompts").select("*").eq("brand_id", brandId).eq("active", opts.active);
  const ordered = filtered
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  const offset = opts?.offset ?? 0;
  const { data, error } = await (opts?.limit === undefined
    ? ordered
    : ordered.range(offset, offset + opts.limit - 1));
  if (error) throw error;
  return (data ?? []) as Prompt[];
}

/**
 * A prompt IF it belongs to `brandId`, else null — the ownership guard for
 * prompt-scoped routes (so one brand's request can never read another's prompt).
 */
export async function getPromptForBrand(promptId: string, brandId: string): Promise<Prompt | null> {
  const prompt = await getPromptById(promptId);
  return prompt && prompt.brand_id === brandId ? prompt : null;
}

/** Soft on/off — keeps scan history intact (the FK forbids hard-deleting). */
export async function setPromptActive(
  promptId: string,
  active: boolean,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("prompts")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", promptId);
  if (error) throw error;
}

/** Create one user-authored prompt (active, ungrouped). Used by the editor. */
export async function createPrompt(brandId: string, text: string): Promise<Prompt> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("prompts")
    .insert({ brand_id: brandId, text, active: true, topic_id: null })
    .select("*")
    .single();
  if (error) throw error;
  return data as Prompt;
}

/** Edit a prompt's question text. */
export async function updatePromptText(promptId: string, text: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("prompts")
    .update({ text, updated_at: new Date().toISOString() })
    .eq("id", promptId);
  if (error) throw error;
}

/** A single prompt by id, or null — used to verify account ownership on writes. */
export async function getPromptById(promptId: string): Promise<Prompt | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("prompts")
    .select("*")
    .eq("id", promptId)
    .maybeSingle();
  if (error) throw error;
  return (data as Prompt | null) ?? null;
}

/**
 * Count active prompts across the given brands — the per-account usage total the
 * prompt limit is enforced against (the limit is account-wide, not per brand).
 */
export async function countActivePrompts(brandIds: string[]): Promise<number> {
  if (brandIds.length === 0) return 0;
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("prompts")
    .select("id", { count: "exact", head: true })
    .in("brand_id", brandIds)
    .eq("active", true);
  if (error) throw error;
  return count ?? 0;
}

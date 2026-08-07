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

/** All prompts for a brand, active first isn't assumed — caller filters. */
export async function listPrompts(brandId: string): Promise<Prompt[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("prompts")
    .select("*")
    .eq("brand_id", brandId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Prompt[];
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

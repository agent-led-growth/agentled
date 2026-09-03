import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import type { Topic } from "./types";

/**
 * Topic reads/writes. Suggested topics are seeded at pre-scan (all `selected =
 * false`); the onboarding pick flips the chosen ones on and adds any custom
 * ones. Post-gate the user can keep editing them.
 */

/** Seed the pre-scan's suggested topics, unselected, in order. */
export async function insertSuggestedTopics(
  brandId: string,
  labels: string[],
): Promise<Topic[]> {
  const clean = labels.map((l) => l.trim()).filter(Boolean);
  if (clean.length === 0) return [];

  const admin = createAdminClient();
  const rows = clean.map((label, i) => ({
    brand_id: brandId,
    label,
    selected: false,
    sort_order: i,
  }));
  const { data, error } = await admin.from("topics").insert(rows).select("*");
  if (error) throw error;
  return (data ?? []) as Topic[];
}

/**
 * Replace a brand's suggested topics wholesale: clear what's there, then seed
 * the new suggestions (unselected). Used on (re-)enrichment so refreshed
 * suggestions supersede stale ones instead of piling up when a URL is
 * re-onboarded.
 */
export async function resetSuggestedTopics(
  brandId: string,
  labels: string[],
): Promise<Topic[]> {
  const admin = createAdminClient();
  const { error } = await admin.from("topics").delete().eq("brand_id", brandId);
  if (error) throw error;
  return insertSuggestedTopics(brandId, labels);
}

export async function listTopics(brandId: string): Promise<Topic[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("topics")
    .select("*")
    .eq("brand_id", brandId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Topic[];
}

/**
 * Persist the onboarding selection: mark the chosen labels `selected = true`,
 * everything else `false`, and create any chosen label that doesn't exist yet
 * (a custom topic). Idempotent. Returns the brand's topics after the change.
 */
export async function setSelectedTopics(
  brandId: string,
  selectedLabels: string[],
): Promise<Topic[]> {
  const admin = createAdminClient();
  const chosen = new Set(selectedLabels.map((l) => l.trim()).filter(Boolean));

  const existing = await listTopics(brandId);
  const selectIds = existing.filter((t) => chosen.has(t.label)).map((t) => t.id);
  const unselectIds = existing
    .filter((t) => !chosen.has(t.label) && t.selected)
    .map((t) => t.id);

  if (selectIds.length > 0) {
    const { error } = await admin
      .from("topics")
      .update({ selected: true })
      .in("id", selectIds);
    if (error) throw error;
  }
  if (unselectIds.length > 0) {
    const { error } = await admin
      .from("topics")
      .update({ selected: false })
      .in("id", unselectIds);
    if (error) throw error;
  }

  const existingLabels = new Set(existing.map((t) => t.label));
  const toAdd = [...chosen].filter((label) => !existingLabels.has(label));
  if (toAdd.length > 0) {
    const base = existing.length;
    const rows = toAdd.map((label, i) => ({
      brand_id: brandId,
      label,
      selected: true,
      sort_order: base + i,
    }));
    const { error } = await admin.from("topics").insert(rows);
    if (error) throw error;
  }

  return listTopics(brandId);
}

/** Topics the user picked — the set prompts are generated from. */
export async function listSelectedTopics(brandId: string): Promise<Topic[]> {
  return (await listTopics(brandId)).filter((t) => t.selected);
}

/** Of `brandIds`, the subset that has at least one selected topic (one query). */
export async function brandIdsWithSelectedTopics(brandIds: string[]): Promise<string[]> {
  if (brandIds.length === 0) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("topics")
    .select("brand_id")
    .in("brand_id", brandIds)
    .eq("selected", true);
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => (r as { brand_id: string }).brand_id))];
}

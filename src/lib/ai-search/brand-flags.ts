import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Of `brandIds`, the subset that has at least one row in `table` whose boolean
 * `flag` column is true — one query. Used by the scan sweep to keep only brands
 * with something to scan (active prompts) or to generate from (selected topics).
 */
export async function brandIdsFlagged(
  table: "prompts" | "topics",
  flag: "active" | "selected",
  brandIds: string[],
): Promise<string[]> {
  if (brandIds.length === 0) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from(table)
    .select("brand_id")
    .in("brand_id", brandIds)
    .eq(flag, true);
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => (r as { brand_id: string }).brand_id))];
}

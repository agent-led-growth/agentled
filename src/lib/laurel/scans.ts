import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Writes for the scan-output tables (scans, competitors, mentions, citations).
 * Service-role, server-only — the scan runner is the only writer. Reads for the
 * dashboard live in the metrics layer.
 */

export type Platform = "chatgpt" | "claude";
export type ScanStatus = "ok" | "failed";

/** Insert one scan row, return its id. */
export async function insertScan(row: {
  brandId: string;
  promptId: string;
  platform: Platform;
  model: string;
  answerText: string | null;
  raw: unknown;
  status: ScanStatus;
  error?: string | null;
}): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("scans")
    .insert({
      brand_id: row.brandId,
      prompt_id: row.promptId,
      platform: row.platform,
      model: row.model,
      answer_text: row.answerText,
      raw: row.raw ?? null,
      status: row.status,
      error: row.error ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/**
 * Ensure a competitor row exists for each canonical name and return a
 * lower(name) -> id map. Done in one pass (load existing, insert the rest) to
 * avoid racing the (brand_id, lower(name)) unique index under concurrency.
 */
export async function ensureCompetitors(
  brandId: string,
  canonicalNames: string[],
): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const wanted = [...new Set(canonicalNames.map((n) => n.trim()).filter(Boolean))];

  const { data: existing, error } = await admin
    .from("competitors")
    .select("id,name")
    .eq("brand_id", brandId);
  if (error) throw error;

  const map = new Map<string, string>();
  for (const c of (existing ?? []) as { id: string; name: string }[]) {
    map.set(c.name.toLowerCase(), c.id);
  }

  const toInsert = wanted.filter((n) => !map.has(n.toLowerCase()));
  if (toInsert.length > 0) {
    const { data: inserted, error: insErr } = await admin
      .from("competitors")
      .insert(toInsert.map((name) => ({ brand_id: brandId, name })))
      .select("id,name");
    if (insErr) throw insErr;
    for (const c of (inserted ?? []) as { id: string; name: string }[]) {
      map.set(c.name.toLowerCase(), c.id);
    }
  }
  return map;
}

/** Canonical competitor names for a brand — feeds the extractor's resolution. */
export async function listCompetitorNames(brandId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("competitors")
    .select("name")
    .eq("brand_id", brandId)
    .eq("hidden", false);
  if (error) throw error;
  return ((data ?? []) as { name: string }[]).map((c) => c.name);
}

export async function insertMentions(
  rows: {
    scanId: string;
    brandId: string;
    competitorId: string | null;
    isSelf: boolean;
    mentionedName: string;
    position: number | null;
    platform: Platform;
  }[],
): Promise<void> {
  if (rows.length === 0) return;
  const admin = createAdminClient();
  const { error } = await admin.from("mentions").insert(
    rows.map((r) => ({
      scan_id: r.scanId,
      brand_id: r.brandId,
      competitor_id: r.competitorId,
      is_self: r.isSelf,
      mentioned_name: r.mentionedName,
      position: r.position,
      platform: r.platform,
    })),
  );
  if (error) throw error;
}

export async function insertCitations(
  rows: {
    scanId: string;
    brandId: string;
    platform: Platform;
    url: string;
    domain: string;
    title: string | null;
    isOwnDomain: boolean;
    position: number | null;
  }[],
): Promise<void> {
  if (rows.length === 0) return;
  const admin = createAdminClient();
  const { error } = await admin.from("citations").insert(
    rows.map((r) => ({
      scan_id: r.scanId,
      brand_id: r.brandId,
      platform: r.platform,
      url: r.url,
      domain: r.domain,
      title: r.title,
      is_own_domain: r.isOwnDomain,
      position: r.position,
    })),
  );
  if (error) throw error;
}

import "server-only";

import { getBrandById, markFirstScanComplete } from "./brands";
import { normalizeDomain } from "./domain";
import { extractBrands, type ExtractedBrand } from "./extract";
import { listPrompts } from "./prompts";
import { registry } from "./registry";
import { collectCitations, runWebSearch, type ScanResult } from "./scan";
import {
  ensureCompetitors,
  insertCitations,
  insertMentions,
  insertScan,
  listCompetitorNames,
  type Platform,
} from "./scans";
import type { Prompt } from "./types";

/**
 * Scan runner (pipeline steps 6-8). For a brand's active prompts on one
 * platform: search each with web search, extract the named brands, and store
 * scans + mentions + competitors + citations. One-time and idempotent — guarded
 * by brands.first_scan_completed_at. A per-prompt failure records a `failed`
 * scan row (excluded from metrics) rather than aborting the whole run.
 */

const PLATFORM: Platform = "chatgpt";
const MAX_PROMPTS = 9; // free scan = 3 topics x 3; hard cap on metered calls
const SEARCH_CONCURRENCY = 5;
const EXTRACT_CONCURRENCY = 5;

export type ScanRunResult =
  | { skipped: true; reason: "already-scanned" | "no-prompts" }
  | { skipped: false; scanned: number; failed: number };

export async function runScan(brandId: string): Promise<ScanRunResult> {
  const brand = await getBrandById(brandId);
  if (!brand) throw new Error(`runScan: brand ${brandId} not found`);
  if (brand.first_scan_completed_at) return { skipped: true, reason: "already-scanned" };

  const prompts = (await listPrompts(brandId))
    .filter((p) => p.active)
    .slice(0, MAX_PROMPTS);
  if (prompts.length === 0) {
    await markFirstScanComplete(brandId);
    return { skipped: true, reason: "no-prompts" };
  }

  const ownDomain = normalizeDomain(brand.domain);
  const brandName = brand.name?.trim() || brand.domain;
  const knownCompetitors = await listCompetitorNames(brandId);

  // 1. Search every prompt (concurrent, capped). This is the slow, metered step.
  type Searched =
    | { prompt: Prompt; ok: true; result: ScanResult }
    | { prompt: Prompt; ok: false };
  const searched = await mapPool<Prompt, Searched>(prompts, SEARCH_CONCURRENCY, async (p) => {
    try {
      return { prompt: p, ok: true, result: await runWebSearch(p.text) };
    } catch (err) {
      console.error("runScan: search failed", p.id, err);
      return { prompt: p, ok: false };
    }
  });

  // 2. Extract brands from each successful answer (concurrent, capped).
  type Extracted =
    | { prompt: Prompt; ok: true; result: ScanResult; brands: ExtractedBrand[] }
    | { prompt: Prompt; ok: false };
  const extracted = await mapPool<Searched, Extracted>(searched, EXTRACT_CONCURRENCY, async (s) => {
    if (!s.ok) return { prompt: s.prompt, ok: false };
    try {
      const brands = await extractBrands({
        answerText: s.result.answerText,
        brandName,
        brandDomain: ownDomain,
        knownCompetitors,
      });
      return { prompt: s.prompt, ok: true, result: s.result, brands };
    } catch (err) {
      // A malformed extraction fails this scan's post-processing loudly.
      console.error("runScan: extraction failed", s.prompt.id, err);
      return { prompt: s.prompt, ok: false };
    }
  });

  // 3. Ensure every discovered competitor exists (one pass, no race).
  const competitorNames = extracted.flatMap((e) =>
    e.ok ? e.brands.filter((b) => !b.isSelf).map((b) => b.canonical) : [],
  );
  const competitorIds = await ensureCompetitors(brandId, competitorNames);

  // 4. Persist per prompt: scan row -> mentions + citations (or a failed row).
  let scanned = 0;
  let failed = 0;
  for (const e of extracted) {
    if (!e.ok) {
      await insertScan({
        brandId,
        promptId: e.prompt.id,
        platform: PLATFORM,
        model: registry.scan.model,
        answerText: null,
        raw: null,
        status: "failed",
      });
      failed += 1;
      continue;
    }

    const scanId = await insertScan({
      brandId,
      promptId: e.prompt.id,
      platform: PLATFORM,
      model: e.result.model,
      answerText: e.result.answerText,
      raw: e.result.raw,
      status: "ok",
    });

    await insertMentions(
      e.brands.map((b, idx) => ({
        scanId,
        brandId,
        competitorId: b.isSelf ? null : competitorIds.get(b.canonical.toLowerCase()) ?? null,
        isSelf: b.isSelf,
        mentionedName: b.raw || b.canonical,
        // position = order of first appearance; fall back to array order so a
        // self-mention always has a rank (DB constraint) and competitors too.
        position: b.position > 0 ? b.position : idx + 1,
        platform: PLATFORM,
      })),
    );

    await insertCitations(
      collectCitations(e.result.answerText, e.result.citations, ownDomain).map((c) => ({
        scanId,
        brandId,
        platform: PLATFORM,
        url: c.url,
        domain: c.domain,
        title: c.title,
        isOwnDomain: c.isOwnDomain,
        position: c.position,
      })),
    );
    scanned += 1;
  }

  await markFirstScanComplete(brandId);
  return { skipped: false, scanned, failed };
}

/** Run `fn` over `items` with at most `limit` in flight; preserves order. */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

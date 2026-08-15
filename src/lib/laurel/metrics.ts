import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { getBrandById } from "./brands";
import { isOwnDomain, normalizeDomain } from "./domain";
import { listCompletedRuns } from "./scan-runs";

/**
 * Dashboard metrics — aggregates the scan-output tables into every number the
 * dashboard shows, for one platform, over the brand's (single, one-time) run.
 *
 * Formulas (locked with the doc):
 *  - visibility = ok answers naming you / total ok answers
 *  - leaderboard vis = per brand, answers naming it / same denominator
 *  - rank = standing on that leaderboard (overview + topic groups only)
 *  - position = order of first appearance in an answer (per prompt, averaged)
 *  - group cite = own-domain citations in the topic / all citations in the topic
 *  - domain/page share = its citations / ALL citations in the run (one denominator)
 * Deltas and trends need history, which a one-time scan doesn't have — the API
 * layer renders those as "—" / a single point.
 */

const PLATFORM = "chatgpt";

type ScanRow = { id: string; prompt_id: string; answer_text: string | null; status: string };
type MentionRow = {
  scan_id: string;
  competitor_id: string | null;
  is_self: boolean;
  position: number | null;
  mentioned_name: string;
};
type CitationRow = {
  scan_id: string;
  domain: string;
  url: string;
  title: string | null;
  is_own_domain: boolean;
};
type CompetitorRow = { id: string; name: string };
type PromptRow = { id: string; text: string; topic_id: string | null; active: boolean };
type TopicRow = { id: string; label: string; selected: boolean; sort_order: number | null };

export interface LeaderRow {
  name: string;
  visibility: number; // 0..1
  isSelf: boolean;
}

export interface PromptMetric {
  promptId: string;
  q: string;
  score: number; // 0 or 1 on a single run
  pos: number | null; // self position, null if not named
  cite: number; // own citations in this answer / all citations in this answer
  answer: string | null;
  brands: string[]; // named brands, in order
  cites: string[]; // cited domains (unique)
  highlight: string | null; // the name to emphasise in the answer
}

export interface GroupMetric {
  topicId: string | null;
  name: string;
  promptCount: number;
  score: number;
  rank: number;
  pos: number | null;
  cite: number;
  items: PromptMetric[];
}

export interface DomainMetric {
  domain: string;
  share: number; // citations to domain / all citations in run
  owned: boolean;
  pages: { url: string; share: number; title: string | null }[];
}

export interface BrandMetrics {
  platform: typeof PLATFORM;
  scanned: boolean;
  answers: number; // |S| ok answers
  visibility: number;
  visibilityNamed: number;
  rankValue: number;
  leaderboard: LeaderRow[];
  groups: GroupMetric[];
  citationShare: number;
  citationOwn: number;
  citationTotal: number;
  citationRankValue: number;
  citationDomains: DomainMetric[];
  // History (Slice 4). trend is chronological (oldest → newest); deltas compare
  // the latest completed run to the previous, null when there's no prior run.
  trend: TrendPoint[];
  visibilityDelta: number | null;
  citationDelta: number | null;
  rankDelta: number | null; // positive = moved up (rank got smaller)
}

export interface TrendPoint {
  at: string; // ISO completed_at
  visibility: number; // 0..1
  citationShare: number; // 0..1
}

/** One run's answer to a single prompt — the unit the detail-view navigator browses. */
export interface PromptAnswer {
  runId: string;
  at: string; // ISO completed_at of the run
  answer: string | null;
  promptText: string | null; // the question exactly as it was asked in that run
  named: boolean; // was the monitored brand named in this answer
  highlight: string | null; // the self-mention text to emphasise
  brands: string[]; // brands named, in order of appearance
  cites: string[]; // domains cited (unique)
}

/** The headline numbers for one completed run — everything except history/deltas. */
type RunMetrics = Omit<
  BrandMetrics,
  "trend" | "visibilityDelta" | "citationDelta" | "rankDelta"
>;

export async function getBrandMetrics(brandId: string, sinceIso: string): Promise<BrandMetrics> {
  const brand = await getBrandById(brandId);
  const ownDomain = brand ? normalizeDomain(brand.domain) : "";
  const brandName = brand?.name?.trim() || brand?.domain || "You";

  // Runs accumulate as history. Headline + deltas use the latest vs previous
  // COMPLETED run (unbounded, so a brand always shows its most recent scan); the
  // trend is bounded to the selected date window. Only completed runs count.
  const allRuns = await listCompletedRuns(brandId, 100);
  if (allRuns.length === 0) return emptyMetrics();

  const current = await computeRunMetrics(brandId, allRuns[0].id, ownDomain, brandName);
  const previous = allRuns[1]
    ? await computeRunMetrics(brandId, allRuns[1].id, ownDomain, brandName)
    : null;

  // Compare instants, not ISO strings: PostgREST serializes completed_at with a
  // "+00:00" offset while sinceIso is toISOString()'s "…Z", so a string compare
  // is unreliable (the same offset-format gotcha as the run-token check).
  const sinceMs = new Date(sinceIso).getTime();
  const windowRuns = allRuns.filter((r) => new Date(r.completed_at).getTime() >= sinceMs);
  const trend = await computeTrend(windowRuns, ownDomain);

  return {
    ...current,
    scanned: true, // a completed run exists — independent of its answer count (K4)
    trend,
    visibilityDelta: previous ? current.visibility - previous.visibility : null,
    citationDelta: previous ? current.citationShare - previous.citationShare : null,
    rankDelta: previous ? previous.rankValue - current.rankValue : null,
  };
}

/** The zero state before any scan has completed. */
function emptyMetrics(): BrandMetrics {
  return {
    platform: PLATFORM,
    scanned: false,
    answers: 0,
    visibility: 0,
    visibilityNamed: 0,
    rankValue: 0,
    leaderboard: [],
    groups: [],
    citationShare: 0,
    citationOwn: 0,
    citationTotal: 0,
    citationRankValue: 0,
    citationDomains: [],
    trend: [],
    visibilityDelta: null,
    citationDelta: null,
    rankDelta: null,
  };
}

/**
 * Every headline number for ONE completed run. Formulas are identical to before;
 * scans, mentions and citations are all scoped to `run_id` (mentions/citations
 * carry run_id since 0014), then restricted to this run's ok scans via `okScanIds`.
 */
async function computeRunMetrics(
  brandId: string,
  runId: string,
  ownDomain: string,
  brandName: string,
): Promise<RunMetrics> {
  const admin = createAdminClient();

  const [scansR, mentionsR, citationsR, competitorsR, promptsR, topicsR] = await Promise.all([
    admin.from("scans").select("id,prompt_id,answer_text,status").eq("brand_id", brandId).eq("run_id", runId).eq("platform", PLATFORM),
    admin.from("mentions").select("scan_id,competitor_id,is_self,position,mentioned_name").eq("run_id", runId).eq("platform", PLATFORM),
    admin.from("citations").select("scan_id,domain,url,title,is_own_domain").eq("run_id", runId).eq("platform", PLATFORM),
    admin.from("competitors").select("id,name").eq("brand_id", brandId).eq("hidden", false),
    admin.from("prompts").select("id,text,topic_id,active").eq("brand_id", brandId),
    admin.from("topics").select("id,label,selected,sort_order").eq("brand_id", brandId),
  ]);

  const scans = (scansR.data ?? []) as ScanRow[];
  const mentions = (mentionsR.data ?? []) as MentionRow[];
  const citations = (citationsR.data ?? []) as CitationRow[];
  const competitors = (competitorsR.data ?? []) as CompetitorRow[];
  const prompts = ((promptsR.data ?? []) as PromptRow[]).filter((p) => p.active);
  const topics = (topicsR.data ?? []) as TopicRow[];

  const okScans = scans.filter((s) => s.status === "ok");
  const answers = okScans.length;
  const okScanIds = new Set(okScans.map((s) => s.id));

  // Indexes over the ok scans.
  const mentionsByScan = groupBy(mentions.filter((m) => okScanIds.has(m.scan_id)), (m) => m.scan_id);
  const citationsByScan = groupBy(citations.filter((c) => okScanIds.has(c.scan_id)), (c) => c.scan_id);
  const scanByPrompt = new Map(okScans.map((s) => [s.prompt_id, s]));
  const selfScanIds = new Set(mentions.filter((m) => m.is_self && okScanIds.has(m.scan_id)).map((m) => m.scan_id));

  // ── visibility + leaderboard ────────────────────────────────────────────
  const visibilityNamed = okScans.filter((s) => selfScanIds.has(s.id)).length;
  const visibility = answers ? visibilityNamed / answers : 0;

  const compScans = new Map<string, Set<string>>(); // competitor id -> ok scan ids
  for (const m of mentions) {
    if (!m.competitor_id || !okScanIds.has(m.scan_id)) continue;
    (compScans.get(m.competitor_id) ?? setInMap(compScans, m.competitor_id)).add(m.scan_id);
  }
  const leaderboard = rankBrands(
    [
      { name: brandName, visibility, isSelf: true },
      ...competitors.map((c) => ({
        name: c.name,
        visibility: answers ? (compScans.get(c.id)?.size ?? 0) / answers : 0,
        isSelf: false,
      })),
    ].filter((b) => b.isSelf || b.visibility > 0),
  );
  const rankValue = leaderboard.findIndex((b) => b.isSelf) + 1;

  // ── topic groups + per-prompt ───────────────────────────────────────────
  const promptsByTopic = groupBy(prompts, (p) => p.topic_id ?? "__ungrouped__");
  const topicOrder = [...topics].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  const groups: GroupMetric[] = [];
  const seenTopicKeys = new Set<string>();

  const buildGroup = (key: string, name: string, groupPrompts: PromptRow[]): GroupMetric => {
    const groupScans = groupPrompts
      .map((p) => scanByPrompt.get(p.id))
      .filter((s): s is ScanRow => Boolean(s));
    const gAnswers = groupScans.length;
    const gNamed = groupScans.filter((s) => selfScanIds.has(s.id)).length;
    const gScore = gAnswers ? gNamed / gAnswers : 0;

    // group rank: leaderboard restricted to this topic's scans
    const gScanIds = new Set(groupScans.map((s) => s.id));
    const gComp = new Map<string, number>();
    for (const m of mentions) {
      if (!m.competitor_id || !gScanIds.has(m.scan_id)) continue;
      gComp.set(m.competitor_id, (gComp.get(m.competitor_id) ?? 0) + 1);
    }
    const gLeaders = rankBrands([
      { name: brandName, visibility: gScore, isSelf: true },
      ...competitors.map((c) => ({
        name: c.name,
        visibility: gAnswers ? (gComp.get(c.id) ?? 0) / gAnswers : 0,
        isSelf: false,
      })),
    ]);
    const gRank = gLeaders.findIndex((b) => b.isSelf) + 1;

    const gPos = meanSelfPosition(groupScans, mentionsByScan);
    const gCites = groupScans.flatMap((s) => citationsByScan.get(s.id) ?? []);
    const gCite = gCites.length
      ? gCites.filter((c) => isOwnDomain(ownDomain, c.domain)).length / gCites.length
      : 0;

    return {
      topicId: key === "__ungrouped__" ? null : key,
      name,
      promptCount: groupPrompts.length,
      score: gScore,
      rank: gRank,
      pos: gPos,
      cite: gCite,
      items: groupPrompts.map((p) => promptMetric(p, scanByPrompt.get(p.id), mentionsByScan, citationsByScan, selfScanIds, ownDomain)),
    };
  };

  for (const t of topicOrder) {
    const gp = promptsByTopic.get(t.id);
    if (!gp || gp.length === 0) continue;
    seenTopicKeys.add(t.id);
    groups.push(buildGroup(t.id, t.label, gp));
  }
  const ungrouped = promptsByTopic.get("__ungrouped__");
  if (ungrouped && ungrouped.length > 0) groups.push(buildGroup("__ungrouped__", "Ungrouped", ungrouped));

  // ── citations ───────────────────────────────────────────────────────────
  const okCitations = citations.filter((c) => okScanIds.has(c.scan_id));
  const citationTotal = okCitations.length;
  const citationOwn = okCitations.filter((c) => isOwnDomain(ownDomain, c.domain)).length;
  const citationShare = citationTotal ? citationOwn / citationTotal : 0;

  // Fold the brand's own domains (apex + subdomains, e.g. docs.farcaster.xyz)
  // into a single leaderboard row keyed by the brand domain.
  const byDomain = groupBy(okCitations, (c) =>
    isOwnDomain(ownDomain, c.domain) ? ownDomain : c.domain,
  );
  const domainList = [...byDomain.entries()]
    .map(([domain, rows]) => {
      const byUrl = groupBy(rows, (r) => r.url);
      return {
        domain,
        share: citationTotal ? rows.length / citationTotal : 0,
        owned: isOwnDomain(ownDomain, domain),
        pages: [...byUrl.entries()]
          .map(([url, urlRows]) => ({
            url,
            share: citationTotal ? urlRows.length / citationTotal : 0,
            title: urlRows.find((r) => r.title)?.title ?? null,
          }))
          .sort((a, b) => b.share - a.share),
      };
    })
    .sort((a, b) => b.share - a.share);
  const citationRankValue = domainList.findIndex((d) => d.owned) + 1;

  return {
    platform: PLATFORM,
    scanned: answers > 0,
    answers,
    visibility,
    visibilityNamed,
    rankValue,
    leaderboard,
    groups,
    citationShare,
    citationOwn,
    citationTotal,
    citationRankValue,
    citationDomains: domainList,
  };
}

/**
 * The per-run headline series (visibility + citation share), chronological
 * (oldest → newest), for the trend lines. One batched read over every completed
 * run's ok scans, then grouped by run in JS.
 */
async function computeTrend(
  windowRuns: { id: string; completed_at: string }[],
  ownDomain: string,
): Promise<TrendPoint[]> {
  if (windowRuns.length === 0) return [];
  const admin = createAdminClient();
  const runIds = windowRuns.map((r) => r.id);

  // Everything scopes by run_id (a handful of ids), never a huge scan_id list.
  const [scansR, mentionsR, citationsR] = await Promise.all([
    admin.from("scans").select("id,run_id").in("run_id", runIds).eq("platform", PLATFORM).eq("status", "ok"),
    admin.from("mentions").select("scan_id").in("run_id", runIds).eq("is_self", true),
    admin.from("citations").select("run_id,domain").in("run_id", runIds),
  ]);
  const scans = (scansR.data ?? []) as { id: string; run_id: string }[];
  const selfScanIds = new Set(((mentionsR.data ?? []) as { scan_id: string }[]).map((m) => m.scan_id));
  const cites = (citationsR.data ?? []) as { run_id: string; domain: string }[];

  const scansByRun = groupBy(scans, (s) => s.run_id);
  const citesByRun = groupBy(cites, (c) => c.run_id);

  // windowRuns is newest-first; reverse for a left-to-right timeline.
  return [...windowRuns].reverse().map((run) => {
    const rs = scansByRun.get(run.id) ?? [];
    const answers = rs.length;
    const named = rs.filter((s) => selfScanIds.has(s.id)).length;
    const rc = citesByRun.get(run.id) ?? [];
    const total = rc.length;
    const own = rc.filter((c) => isOwnDomain(ownDomain, c.domain)).length;
    return {
      at: run.completed_at,
      visibility: answers ? named / answers : 0,
      citationShare: total ? own / total : 0,
    };
  });
}

/**
 * Every answer one prompt has produced, newest completed run first — the per-prompt
 * history the detail view's run navigator reads. A run counts if the prompt was part
 * of it, whether the scan succeeded (`ok`) or errored (`failed`, surfaced as an empty
 * answer) — so the newest entry always tracks the latest run the prompt ran in, which
 * keeps the navigator's "latest" chip consistent with the headline score card. Runs
 * where the prompt didn't exist yet have no scan row and are skipped. Each row is
 * self-contained (its as-asked prompt_text, the brands named, the domains cited), so
 * browsing an older run shows THAT run's data. Bounded by the run id list (a handful),
 * never a huge scan_id list.
 */
export async function getPromptAnswers(
  brandId: string,
  promptId: string,
  limit = 12,
): Promise<PromptAnswer[]> {
  const runs = await listCompletedRuns(brandId, limit);
  if (runs.length === 0) return [];
  const admin = createAdminClient();
  const runIds = runs.map((r) => r.id);

  const { data: scanData, error: scanErr } = await admin
    .from("scans")
    .select("id, run_id, answer_text, prompt_text")
    .in("run_id", runIds)
    .eq("prompt_id", promptId)
    .eq("platform", PLATFORM)
    .in("status", ["ok", "failed"]);
  if (scanErr) throw scanErr;
  const scans = (scanData ?? []) as {
    id: string;
    run_id: string;
    answer_text: string | null;
    prompt_text: string | null;
  }[];
  if (scans.length === 0) return [];

  const scanByRun = new Map(scans.map((s) => [s.run_id, s]));
  const scanIds = scans.map((s) => s.id);

  const [mentionsR, citationsR] = await Promise.all([
    admin.from("mentions").select("scan_id, mentioned_name, position, is_self").in("scan_id", scanIds).eq("platform", PLATFORM),
    admin.from("citations").select("scan_id, domain").in("scan_id", scanIds).eq("platform", PLATFORM),
  ]);
  if (mentionsR.error) throw mentionsR.error;
  if (citationsR.error) throw citationsR.error;
  const mentions = (mentionsR.data ?? []) as {
    scan_id: string;
    mentioned_name: string;
    position: number | null;
    is_self: boolean;
  }[];
  const citations = (citationsR.data ?? []) as { scan_id: string; domain: string }[];

  const mentionsByScan = groupBy(mentions, (m) => m.scan_id);
  const citationsByScan = groupBy(citations, (c) => c.scan_id);

  const out: PromptAnswer[] = [];
  for (const run of runs) {
    const scan = scanByRun.get(run.id);
    if (!scan) continue; // the prompt didn't exist yet in this run (no scan row at all)
    const ms = mentionsByScan.get(scan.id) ?? [];
    const cs = citationsByScan.get(scan.id) ?? [];
    const self = ms.find((m) => m.is_self);
    out.push({
      runId: run.id,
      at: run.completed_at,
      answer: scan.answer_text,
      promptText: scan.prompt_text,
      named: Boolean(self),
      highlight: self?.mentioned_name ?? null,
      brands: [...ms].sort(byPosition).map((m) => m.mentioned_name),
      cites: [...new Set(cs.map((c) => c.domain))],
    });
  }
  return out;
}

// ── helpers ─────────────────────────────────────────────────────────────────

function promptMetric(
  p: PromptRow,
  scan: ScanRow | undefined,
  mentionsByScan: Map<string, MentionRow[]>,
  citationsByScan: Map<string, CitationRow[]>,
  selfScanIds: Set<string>,
  ownDomain: string,
): PromptMetric {
  const ms = scan ? mentionsByScan.get(scan.id) ?? [] : [];
  const cs = scan ? citationsByScan.get(scan.id) ?? [] : [];
  const self = ms.find((m) => m.is_self);
  const named = scan ? selfScanIds.has(scan.id) : false;
  return {
    promptId: p.id,
    q: p.text,
    score: named ? 1 : 0,
    pos: self?.position ?? null,
    cite: cs.length ? cs.filter((c) => isOwnDomain(ownDomain, c.domain)).length / cs.length : 0,
    answer: scan?.answer_text ?? null,
    brands: [...ms].sort(byPosition).map((m) => m.mentioned_name),
    cites: [...new Set(cs.map((c) => c.domain))],
    highlight: self?.mentioned_name ?? null,
  };
}

function meanSelfPosition(
  scans: ScanRow[],
  mentionsByScan: Map<string, MentionRow[]>,
): number | null {
  const positions: number[] = [];
  for (const s of scans) {
    const self = (mentionsByScan.get(s.id) ?? []).find((m) => m.is_self);
    if (self?.position != null) positions.push(self.position);
  }
  if (positions.length === 0) return null;
  return positions.reduce((a, b) => a + b, 0) / positions.length;
}

/** Sort brands by visibility desc, self winning ties, then name. */
function rankBrands(rows: LeaderRow[]): LeaderRow[] {
  return [...rows].sort(
    (a, b) =>
      b.visibility - a.visibility ||
      Number(b.isSelf) - Number(a.isSelf) ||
      a.name.localeCompare(b.name),
  );
}

function byPosition(a: { position: number | null }, b: { position: number | null }): number {
  return (a.position ?? 1e9) - (b.position ?? 1e9);
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    (map.get(k) ?? setInMap(map, k, [])).push(item);
  }
  return map;
}

function setInMap<K, V>(map: Map<K, V>, key: K, value?: V): V {
  const v = value ?? (new Set() as unknown as V);
  map.set(key, v);
  return v;
}

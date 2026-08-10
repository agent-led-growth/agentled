import type { BrandMetrics, LeaderRow } from "@/lib/laurel/metrics";

import type { CitationDomain, ChartInput, Group } from "./fixtures";

/**
 * Formats the raw BrandMetrics into the exact shapes the dashboard components
 * already consume. A one-time scan has no history, so every delta is "—" and the
 * trend charts are a single flat point (per the product decision).
 */

const DASH = "—";

const pct1 = (frac: number) => `${(frac * 100).toFixed(1)}%`;
const pct0 = (frac: number) => `${Math.round(frac * 100)}%`;

/** A flat, single-point chart: the value sits on the middle gridline, no trend. */
function flatChart(percent: number): ChartInput {
  const y = 66; // middle gridline of the 0 0 620 190 viewBox
  const r = (n: number) => Number(n.toFixed(1));
  return {
    yLabels: [`${r(percent + 6)}%`, `${r(percent)}%`, `${r(percent - 6)}%`, `${r(percent - 12)}%`],
    xLabels: ["", "", "", "", "", "now"],
    gridlines: [12, 66, 120],
    baseline: 174,
    current: `14,${y} 606,${y}`,
    previous: "", // no prior run yet
    endDot: { cx: 606, cy: y },
  };
}

/** Top 5 by the metric, plus the brand's own row pinned if it's outside the top 5. */
function topWithSelf<T extends { rank: number }>(
  ranked: T[],
  selfRank: number,
  isSelf: (row: T) => boolean,
): T[] {
  const top = ranked.slice(0, 5);
  if (selfRank > 5) {
    const self = ranked.find(isSelf);
    if (self) top.push(self);
  }
  return top;
}

export function toVisibility(m: BrandMetrics) {
  return {
    score: pct1(m.visibility),
    delta: DASH,
    detail: `${m.visibilityNamed} of ${m.answers} answers`,
    ...flatChart(m.visibility * 100),
  };
}

export function toRank(m: BrandMetrics) {
  const ranked = m.leaderboard.map((r: LeaderRow, i) => ({ ...r, rank: i + 1 }));
  const rows = topWithSelf(ranked, m.rankValue, (r) => r.isSelf).map((r) => ({
    i: r.rank,
    name: r.name,
    vis: pct0(r.visibility),
    delta: DASH,
    you: r.isSelf,
  }));
  return { value: `#${m.rankValue}`, delta: DASH, rows };
}

export function toCitation(m: BrandMetrics) {
  return {
    score: pct1(m.citationShare),
    delta: DASH,
    detail: `${m.citationOwn} of ${m.citationTotal} citations`,
    ...flatChart(m.citationShare * 100),
  };
}

export function toCitationRank(m: BrandMetrics) {
  const ranked = m.citationDomains.map((d, i) => ({ ...d, rank: i + 1 }));
  const rows: CitationDomain[] = topWithSelf(ranked, m.citationRankValue || 99, (d) => d.owned).map(
    (d) => ({
      i: d.rank,
      domain: d.domain,
      share: pct1(d.share),
      delta: DASH,
      owned: d.owned,
      pages: d.pages.map((p) => ({
        url: p.url,
        share: pct1(p.share),
        dShare: DASH,
        global: "", // "global" column is hidden for v1
        dGlobal: "",
      })),
    }),
  );
  // Unranked = the brand's own domain isn't cited anywhere in the run.
  return {
    value: m.citationRankValue ? `#${m.citationRankValue}` : "Not ranked",
    delta: DASH,
    rows,
  };
}

export function toGroups(m: BrandMetrics): Group[] {
  return m.groups.map((g) => ({
    name: g.name,
    count: `${g.promptCount} prompt${g.promptCount === 1 ? "" : "s"}`,
    rank: `#${g.rank}`,
    score: pct0(g.score),
    dScore: DASH,
    pos: g.pos != null ? g.pos.toFixed(1) : DASH,
    dPos: DASH,
    cite: pct1(g.cite),
    dCite: DASH,
    items: g.items.map((p) => ({
      q: p.q,
      rank: DASH, // per-prompt rank dropped — every named brand ties at 100%
      score: pct0(p.score),
      dScore: DASH,
      pos: p.pos != null ? String(p.pos) : DASH,
      dPos: DASH,
      cite: pct1(p.cite),
      dCite: DASH,
      platform: "ChatGPT",
      answer: p.answer ?? "",
      brands: p.brands.join(" · "),
      cites: p.cites.join(" · "),
      highlight: p.highlight ?? undefined,
    })),
  }));
}

/** Everything the dashboard body needs, derived once from a metrics payload. */
export function formatMetrics(m: BrandMetrics) {
  return {
    visibility: toVisibility(m),
    rank: toRank(m),
    citation: toCitation(m),
    citationRank: toCitationRank(m),
    groups: toGroups(m),
  };
}

export type DashboardData = ReturnType<typeof formatMetrics>;

import type { BrandMetrics, LeaderRow } from "@/lib/laurel/metrics";

import type { CitationDomain, ChartInput, Group } from "./fixtures";

/**
 * Formats the raw BrandMetrics into the exact shapes the dashboard components
 * already consume. Trend charts and the top-line deltas come from the run
 * history; a single completed run renders one flat point with "—" deltas.
 * Per-prompt/group deltas stay "—" — a deliberate follow-up, not this slice.
 */

/** The no-history / no-comparison marker. A one-time scan has no deltas. */
export const DASH = "—";

const pct1 = (frac: number) => `${(frac * 100).toFixed(1)}%`;
const pct0 = (frac: number) => `${Math.round(frac * 100)}%`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** A run timestamp as "14 Aug" (UTC) — shared by the trend axis and the answer-nav chips. */
export const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

/**
 * Line chart from a percentage series (0..100), oldest → newest, mapped into the
 * 0 0 620 190 viewBox (x 14→606, y 12→120 with the value auto-scaled). One point
 * renders as a flat line. `previous` is empty — the trend line IS the history.
 */
function seriesChart(values: number[], xLabels: string[]): ChartInput {
  const yTop = 12;
  const yBottom = 120;
  const r = (n: number) => Math.round(n);

  const min = Math.min(...values);
  const max = Math.max(...values);
  const lo = Math.max(0, Math.floor(min - 3));
  let hi = Math.ceil(max + 3);
  if (hi - lo < 6) hi = lo + 6; // keep a minimum span so a flat series isn't 0-height

  const yFor = (v: number) => yBottom - ((v - lo) / (hi - lo)) * (yBottom - yTop);
  const n = values.length;
  const xFor = (i: number) => (n <= 1 ? 606 : 14 + (i / (n - 1)) * (606 - 14));

  const current =
    n <= 1
      ? `14,${r(yFor(values[0]))} 606,${r(yFor(values[0]))}`
      : values.map((v, i) => `${r(xFor(i))},${r(yFor(v))}`).join(" ");

  const yLabels = [hi, lo + (hi - lo) * (2 / 3), lo + (hi - lo) / 3, lo].map(
    (v) => `${Number(v.toFixed(1))}%`,
  );

  return {
    yLabels,
    xLabels,
    gridlines: [12, 66, 120],
    baseline: 174,
    current,
    previous: "",
    endDot: { cx: 606, cy: r(yFor(values[n - 1])) },
  };
}

/** A percentage-point delta ("+6.0 pp" / "−3.0 pp"), or DASH when unavailable/flat. */
function ppDelta(delta: number | null): string {
  if (delta == null) return DASH;
  const pp = Number((delta * 100).toFixed(1));
  if (pp === 0) return DASH;
  return `${pp > 0 ? "+" : "−"}${Math.abs(pp).toFixed(1)} pp`;
}

/** A rank delta ("▲ 1" up / "▼ 1" down), or DASH when unavailable/flat. */
function rankDelta(delta: number | null): string {
  if (delta == null || delta === 0) return DASH;
  return delta > 0 ? `▲ ${delta}` : `▼ ${Math.abs(delta)}`;
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
  const chart = m.trend.length
    ? seriesChart(m.trend.map((p) => p.visibility * 100), m.trend.map((p) => shortDate(p.at)))
    : seriesChart([m.visibility * 100], ["now"]);
  return {
    score: pct1(m.visibility),
    delta: ppDelta(m.visibilityDelta),
    detail: `${m.visibilityNamed} of ${m.answers} answers`,
    ...chart,
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
  return { value: `#${m.rankValue}`, delta: rankDelta(m.rankDelta), rows };
}

export function toCitation(m: BrandMetrics) {
  const chart = m.trend.length
    ? seriesChart(m.trend.map((p) => p.citationShare * 100), m.trend.map((p) => shortDate(p.at)))
    : seriesChart([m.citationShare * 100], ["now"]);
  return {
    score: pct1(m.citationShare),
    delta: ppDelta(m.citationDelta),
    detail: `${m.citationOwn} of ${m.citationTotal} citations`,
    ...chart,
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
    ranked: Boolean(m.citationRankValue),
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
      promptId: p.promptId,
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

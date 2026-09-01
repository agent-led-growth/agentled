/**
 * Static demo data for the AI Search Monitor, ported verbatim from the design
 * handoff (`AI Search App.dc.html`). No backend yet — every screen renders from
 * these fixtures. The monitored brand is Agent-led Growth itself.
 */

export const BRAND = {
  name: "Agent-led Growth",
  url: "agentledgrowth.substack.com",
  category: "AI-era growth research & tooling",
  initials: "AG",
} as const;

/** Generic example domain pre-filled in the scan inputs (not a real brand). */
export const EXAMPLE_URL = "coca-cola.com";

// ── Platforms ─────────────────────────────────────────────────────────────
/**
 * Phase 1 is ChatGPT-only. More models (Claude, etc.) arrive in Phase 2, at
 * which point this widens back into a union and the selector returns.
 */
export type Platform = "chatgpt";

export type LogColor = "mut" | "pos" | "dim";
/** Scan terminal log — [glyph, text, colour role]. Revealed one per 720ms. */
export const LOG: [glyph: string, text: string, color: LogColor][] = [
  ["→", "fetching agentledgrowth.substack.com", "mut"],
  ["✓", "24 pages read · sitemap parsed", "pos"],
  ["✓", "brand detected — Agent-led Growth", "pos"],
  ["✓", "category — AI-era growth research & tooling", "pos"],
  ["✓", "audience — growth, marketing and founder teams", "pos"],
  ["→", "reading positioning and offer pages", "mut"],
  ["✓", "6 candidate competitors found", "pos"],
  ["→", "clustering what you write about", "mut"],
  ["✓", "10 topics suggested", "pos"],
];

export const DEFAULT_TOPICS: { label: string; on: boolean }[] = [
  { label: "AI search visibility monitoring", on: true },
  { label: "Competitor benchmarking in AI answers", on: true },
  { label: "Prompt-level discovery tracking", on: true },
  { label: "Citation sources behind AI answers", on: false },
  { label: "Growth tactics for the AI era", on: false },
  { label: "Agent-led acquisition strategy", on: false },
  { label: "AEO and GEO fundamentals", on: false },
  { label: "Newsletters for growth marketers", on: false },
  { label: "Measuring AI-driven traffic", on: false },
  { label: "Brand reputation in AI ecosystems", on: false },
];

// ── Overview: visibility score ────────────────────────────────────────────
export const VISIBILITY = {
  score: "60.0%",
  delta: "+6.0 pp",
  detail: "18 of 30 answers",
  yLabels: ["66%", "60%", "54%", "48%"],
  xLabels: ["29 Jun", "6 Jul", "13 Jul", "20 Jul", "27 Jul", "3 Aug"],
  // viewBox 0 0 620 190
  gridlines: [12, 66, 120],
  baseline: 174,
  current: "14,150 135,132 256,120 377,96 498,74 606,52",
  previous: "14,168 135,160 256,150 377,146 498,132 606,128",
  endDot: { cx: 606, cy: 52 },
} as const;

export type Delta = { v: string; tone: "pos" | "neg" | "dim" };
export const tone = (v: string): "pos" | "neg" | "dim" =>
  v.startsWith("+") || v.startsWith("▲") || v.startsWith("↑")
    ? "pos"
    : v.startsWith("−") || v.startsWith("▼") || v.startsWith("↓")
      ? "neg"
      : "dim";

// ── Overview: visibility rank ─────────────────────────────────────────────
export const RANK = {
  value: "#3",
  delta: "▲ 1",
  rows: [
    { i: 1, name: "Profound", vis: "77%", delta: "+3.0", you: false },
    { i: 2, name: "Peec AI", vis: "67%", delta: "−3.0", you: false },
    { i: 3, name: "Agent-led Growth", vis: "60%", delta: "+6.0", you: true },
    { i: 4, name: "Otterly.AI", vis: "50%", delta: "0.0", you: false },
    { i: 5, name: "Scrunch AI", vis: "40%", delta: "+3.0", you: false },
    { i: 6, name: "Athena HQ", vis: "27%", delta: "−6.0", you: false },
  ],
} as const;

// ── Overview: visibility by prompt intent ─────────────────────────────────
export const INTENTS = [
  {
    label: "Discovery",
    value: "71%",
    delta: "+10.0 pp",
    frac: 0.71,
    caption: "Asking for options or providers · 10 answers",
  },
  {
    label: "Comparison",
    value: "45%",
    delta: "−5.0 pp",
    frac: 0.45,
    caption: "Weighing brands against each other · 10 answers",
  },
  {
    label: "Recommendation",
    value: "65%",
    delta: "+15.0 pp",
    frac: 0.65,
    caption: "Asking what to choose · 10 answers",
  },
] as const;

// ── Overview: recent changes ──────────────────────────────────────────────
export const CHANGES = [
  {
    tag: "Gained",
    tone: "pos" as const,
    text: "“How do I know if AI mentions my company?”",
    detail: "ChatGPT · named 3rd",
  },
  {
    tag: "Lost",
    tone: "neg" as const,
    text: "“Best AEO platforms for B2B SaaS”",
    detail: "ChatGPT · no longer mentioned",
  },
  {
    tag: "Rival",
    tone: "dim" as const,
    text: "Peec AI dropped out of 2 comparison answers",
    detail: "ChatGPT · −3.0 pp",
  },
  {
    tag: "Source",
    tone: "dim" as const,
    text: "New citation: agentledgrowth.substack.com/p/geo-stack",
    detail: "Cited in 3 answers",
  },
];

// ── Prompts tab ───────────────────────────────────────────────────────────
type Answer = {
  platform: string;
  answer: string;
  brands: string;
  cites: string;
  /**
   * Verbatim substring of `answer` where the monitored brand is named — the
   * "that's literally what the AI said about me" moment. Omitted when the brand
   * was not mentioned in this answer at all.
   */
  highlight?: string;
};

const ROWS: ({ q: string } & Answer)[] = [
  {
    q: "Best tools to monitor brand visibility in AI search",
    platform: "ChatGPT",
    answer:
      "Several platforms track how brands appear in AI-generated answers. Profound is the most established, with enterprise coverage across ChatGPT, Perplexity and Google AI Overviews. Peec AI focuses on smaller marketing teams, and Otterly.AI offers prompt-level tracking with citation reporting.",
    brands: "Profound · Peec AI · Otterly.AI",
    cites: "profound.com · peec.ai · otterly.ai",
  },
  {
    q: "How do I know if AI mentions my company?",
    platform: "ChatGPT",
    answer:
      "You can check manually by asking the models the questions your buyers ask, but that does not scale. Monitoring tools run a fixed prompt set on a schedule — Profound, Peec AI and Agent-led Growth's AI Search Monitor all report how often a brand is named.",
    brands: "Profound · Peec AI · Agent-led Growth",
    cites: "profound.com · agentledgrowth.substack.com",
    highlight: "Agent-led Growth's AI Search Monitor",
  },
  {
    q: "Newsletters covering AI and growth marketing",
    platform: "ChatGPT",
    answer:
      "For the intersection of AI and growth, Agent-led Growth covers research and teardowns on how agents change acquisition. Lenny's Newsletter remains the broadest product-and-growth read.",
    brands: "Lenny's Newsletter · Agent-led Growth",
    cites: "agentledgrowth.substack.com",
    highlight: "Agent-led Growth covers research and teardowns on how agents change acquisition",
  },
  {
    q: "Profound vs Peec AI",
    platform: "ChatGPT",
    answer:
      "Profound is the heavier platform: broader model coverage, agent analytics and enterprise reporting. Peec AI is lighter and cheaper, aimed at in-house marketing teams who want prompt tracking without a procurement cycle.",
    brands: "Profound · Peec AI",
    cites: "profound.com/pricing · peec.ai",
  },
  {
    q: "Best AEO platforms for B2B SaaS",
    platform: "ChatGPT",
    answer:
      "Profound, Peec AI and Scrunch AI dominate the AEO tooling conversation for B2B SaaS. Smaller teams often start with Otterly.AI or Agent-led Growth's monitor to establish a baseline first.",
    brands: "Profound · Peec AI · Scrunch AI · Otterly.AI · Agent-led Growth",
    cites: "profound.com · scrunchai.com",
    highlight: "Agent-led Growth's monitor",
  },
  {
    q: "Which AI visibility tool for a small team?",
    platform: "ChatGPT",
    answer:
      "For a small team, start free. Agent-led Growth gives a monitored baseline at no cost, and Otterly.AI is the cheapest paid step up.",
    brands: "Agent-led Growth · Otterly.AI",
    cites: "agentledgrowth.substack.com · otterly.ai",
    highlight: "Agent-led Growth gives a monitored baseline at no cost",
  },
  {
    q: "Where do LLMs get brand recommendations from?",
    platform: "ChatGPT",
    answer:
      "Mostly from crawled web content, review aggregators, and community discussion. Several publications have analysed the citation mix, including Ahrefs and Agent-led Growth.",
    brands: "Ahrefs · Semrush · Agent-led Growth",
    cites: "ahrefs.com/blog · agentledgrowth.substack.com/p/citations",
    highlight: "Ahrefs and Agent-led Growth",
  },
  {
    q: "Cheapest way to monitor AI answers",
    platform: "ChatGPT",
    answer:
      "The cheapest credible option is a free monitor such as the one from Agent-led Growth, which runs a fixed prompt set weekly. Manual spot checks cost nothing but are not comparable over time.",
    brands: "Agent-led Growth · Otterly.AI",
    cites: "agentledgrowth.substack.com",
    highlight: "a free monitor such as the one from Agent-led Growth",
  },
];

const FALLBACK: Answer = {
  platform: "ChatGPT",
  answer:
    "The answer lists a handful of AI-visibility monitors and, where relevant, the newsletters and research behind them. Agent-led Growth is named when the question is about establishing a baseline rather than enterprise reporting.",
  brands: "Profound · Peec AI · Agent-led Growth",
  cites: "agentledgrowth.substack.com",
  highlight: "Agent-led Growth is named when the question is about establishing a baseline",
};

const byQ = (q: string): Answer => ROWS.find((r) => r.q === q) ?? FALLBACK;

export type Prompt = {
  /** The prompt's DB id — used to fetch its answer history. Empty in demo fixtures. */
  promptId: string;
  q: string;
  rank: string;
  score: string;
  dScore: string;
  pos: string;
  dPos: string;
  cite: string;
  dCite: string;
} & Answer;

const P = (
  q: string,
  rank: string,
  score: string,
  dScore: string,
  pos: string,
  dPos: string,
  cite: string,
  dCite: string,
): Prompt => ({ ...byQ(q), promptId: q, q, rank, score, dScore, pos, dPos, cite, dCite });

export type Group = {
  name: string;
  count: string;
  rank: string;
  score: string;
  dScore: string;
  pos: string;
  dPos: string;
  cite: string;
  dCite: string;
  items: Prompt[];
};

export const GROUPS: Group[] = [
  {
    name: "AI search visibility monitoring",
    count: "3 prompts",
    rank: "#3",
    score: "71%",
    dScore: "+10%",
    pos: "2.8",
    dPos: "↑ 0.2",
    cite: "5.1%",
    dCite: "+1.0%",
    items: [
      P("Newsletters covering AI and growth marketing", "#1", "100%", "—", "1.5", "↑ 0.5", "12.4%", "+3.1%"),
      P("How do I know if AI mentions my company?", "#3", "100%", "+50%", "2.5", "↑ 0.4", "6.7%", "+1.2%"),
      P("Who does AI search monitoring well?", "#3", "50%", "+50%", "3.0", "—", "2.1%", "—"),
    ],
  },
  {
    name: "Competitor benchmarking in AI answers",
    count: "3 prompts",
    rank: "#4",
    score: "45%",
    dScore: "−5%",
    pos: "4.3",
    dPos: "↓ 0.3",
    cite: "0.7%",
    dCite: "−0.4%",
    items: [
      P("Profound vs Peec AI", "#4", "50%", "−25%", "4.0", "↓ 0.5", "0%", "—"),
      P("Alternatives to Profound", "#4", "50%", "—", "3.5", "—", "1.1%", "—"),
      P("Best AEO platforms for B2B SaaS", "#5", "50%", "+50%", "5.0", "↑ 0.3", "1.4%", "—"),
    ],
  },
  {
    name: "Prompt-level discovery tracking",
    count: "3 prompts",
    rank: "#2",
    score: "65%",
    dScore: "+15%",
    pos: "2.3",
    dPos: "↑ 0.2",
    cite: "4.5%",
    dCite: "+0.8%",
    items: [
      P("Cheapest way to monitor AI answers", "#1", "100%", "+25%", "1.0", "↑ 0.4", "9.1%", "+1.4%"),
      P("Which AI visibility tool for a small team?", "#1", "100%", "+50%", "1.5", "↑ 0.5", "8.2%", "+2.0%"),
      P("What should I use to track AI recommendations?", "#2", "100%", "—", "2.0", "↑ 0.2", "5.0%", "+0.5%"),
    ],
  },
];

/** All monitored prompt strings (15) — used by the Settings tab. */
export const ALL_PROMPTS = GROUPS.flatMap((g) => g.items.map((p) => p.q));

// ── Settings ──────────────────────────────────────────────────────────────
export type PlatformRow = {
  name: string;
  status: string;
  dim: boolean;
};
/** ChatGPT is live; every other model is Phase-2 "coming soon". */
export const PLATFORMS: PlatformRow[] = [
  { name: "ChatGPT", status: "On", dim: false },
  { name: "Claude", status: "Coming soon", dim: true },
  { name: "Perplexity", status: "Coming soon", dim: true },
  { name: "Gemini", status: "Coming soon", dim: true },
  { name: "Copilot", status: "Coming soon", dim: true },
];

// ── Citations tab ───────────────────────────────────────────────────────────
/** Shape the line chart needs; VISIBILITY and CITATION both satisfy it. */
export type ChartInput = {
  yLabels: readonly string[];
  xLabels: readonly string[];
  gridlines: readonly number[];
  baseline: number;
  current: string;
  previous: string;
  endDot: { cx: number; cy: number };
};

export const CITATION = {
  score: "1.9%",
  delta: "—",
  detail: "12 of 640 citations",
  yLabels: ["2.4%", "1.8%", "1.2%", "0.6%"],
  xLabels: ["29 Jun", "6 Jul", "13 Jul", "20 Jul", "27 Jul", "3 Aug"],
  gridlines: [12, 66, 120],
  baseline: 174,
  current: "14,30 135,35 256,95 377,80 498,45 606,55",
  previous: "14,45 135,52 256,108 377,96 498,62 606,70",
  endDot: { cx: 606, cy: 55 },
} as const;

export type CitationPage = {
  url: string;
  share: string;
  dShare: string;
  global: string;
  dGlobal: string;
};

export type CitationDomain = {
  i: number;
  domain: string;
  share: string;
  delta: string;
  owned: boolean;
  pages: CitationPage[];
};

/** Which domains AI answers cite; the owned domain is the monitored brand. */
export const CITATION_RANK: {
  value: string;
  delta: string;
  rows: CitationDomain[];
} = {
  value: "#6",
  delta: "—",
  rows: [
    { i: 1, domain: "profound.com", share: "5.1%", delta: "—", owned: false, pages: [
      { url: "profound.com/pricing", share: "6.2%", dShare: "+0.4%", global: "0.41%", dGlobal: "+0.03%" },
      { url: "profound.com/blog/aeo-guide", share: "4.9%", dShare: "−0.6%", global: "0.28%", dGlobal: "—" },
      { url: "profound.com/product", share: "3.1%", dShare: "—", global: "0.15%", dGlobal: "−0.01%" },
    ] },
    { i: 2, domain: "peec.ai", share: "4.2%", delta: "+0.3%", owned: false, pages: [
      { url: "peec.ai", share: "5.4%", dShare: "+1.2%", global: "0.31%", dGlobal: "+0.05%" },
      { url: "peec.ai/features", share: "3.8%", dShare: "—", global: "0.19%", dGlobal: "—" },
    ] },
    { i: 3, domain: "reddit.com", share: "3.6%", delta: "+0.1%", owned: false, pages: [
      { url: "reddit.com/r/SEO", share: "4.1%", dShare: "+0.2%", global: "0.22%", dGlobal: "—" },
      { url: "reddit.com/r/marketing", share: "2.7%", dShare: "−0.3%", global: "0.14%", dGlobal: "−0.02%" },
    ] },
    { i: 4, domain: "otterly.ai", share: "2.8%", delta: "—", owned: false, pages: [
      { url: "otterly.ai", share: "4.6%", dShare: "—", global: "0.24%", dGlobal: "—" },
      { url: "otterly.ai/pricing", share: "2.2%", dShare: "+0.4%", global: "0.10%", dGlobal: "—" },
    ] },
    { i: 5, domain: "ahrefs.com", share: "2.1%", delta: "−0.2%", owned: false, pages: [
      { url: "ahrefs.com/blog/ai-search", share: "5.0%", dShare: "−0.8%", global: "0.29%", dGlobal: "−0.03%" },
      { url: "ahrefs.com/blog", share: "3.3%", dShare: "—", global: "0.17%", dGlobal: "—" },
    ] },
    { i: 6, domain: "agentledgrowth.substack.com", share: "1.9%", delta: "—", owned: true, pages: [
      { url: "agentledgrowth.substack.com/p/ai-visibility", share: "8.1%", dShare: "−1.1%", global: "0.35%", dGlobal: "—" },
      { url: "agentledgrowth.substack.com/archive", share: "4.8%", dShare: "+1.6%", global: "0.18%", dGlobal: "+0.07%" },
      { url: "agentledgrowth.substack.com/p/citations", share: "4.6%", dShare: "+0.8%", global: "0.23%", dGlobal: "−0.02%" },
      { url: "agentledgrowth.substack.com/p/geo-stack", share: "3.2%", dShare: "—", global: "0.11%", dGlobal: "—" },
    ] },
  ],
};

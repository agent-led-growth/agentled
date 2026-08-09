import "server-only";

import { env } from "@/lib/env";

/**
 * Reader (step 2): turn a domain into enrichment-ready text.
 *
 * Not just the homepage — a bounded crawl. The root often under-describes a
 * brand (or, on Substack/JS/bot-walled sites, returns a CAPTCHA shell), so we:
 *   1. read the homepage through Jina's *browser* engine (renders JS, gets past
 *      the bot walls that defeat a plain fetch),
 *   2. discover more URLs (homepage links + sitemap.xml + RSS feed),
 *   3. read the handful of highest-signal pages (about / pricing / product /
 *      recent posts), and
 *   4. stitch them together, capped.
 *
 * Everything is best-effort and time-boxed: whatever pages come back within the
 * budget get combined; the rest are dropped. Returns null only if nothing read.
 */

const MAX_TOTAL_CHARS = 25_000; // combined budget handed to the model
const MAX_PAGE_CHARS = 8_000; // per-page cap before combining
const MAX_PAGES = 6; // homepage + up to 5 discovered pages
const PAGE_TIMEOUT_MS = 10_000; // per Jina call
const DISCOVERY_TIMEOUT_MS = 6_000; // sitemap / feed fetches
const UA = "Mozilla/5.0 (compatible; agentled.co crawler)";

// Path hints that make a page worth reading, best first.
const SIGNAL = [
  "/about",
  "/pricing",
  "/product",
  "/features",
  "/solution",
  "/service",
  "/how-it-works",
  "/use-case",
  "/customers",
  "/p/", // Substack / blog posts
  "/blog",
  "/post",
  "/docs",
];
// Paths that are never useful for brand understanding.
const EXCLUDE = [
  "login",
  "signin",
  "sign-in",
  "signup",
  "sign-up",
  "subscribe",
  "account",
  "cart",
  "checkout",
  "privacy",
  "terms",
  "legal",
  "cookie",
  "/tag/",
  "/category/",
  "/author/",
  "/comments",
  "/feed",
  "mailto:",
];

/** Combined, capped page text for `host`, or null if nothing could be read. */
export async function readSiteContent(host: string): Promise<string | null> {
  const home = `https://${host}`;

  // Homepage (browser-rendered) + cheap discovery, in parallel.
  const [homeText, sitemapUrls, feedUrls] = await Promise.all([
    jinaRead(home, true),
    fetchSitemapUrls(host),
    fetchFeedUrls(host),
  ]);

  // Candidate URLs, homepage links first (most relevant), then posts, then map.
  const candidates = [
    ...(homeText ? extractLinks(homeText, host) : []),
    ...feedUrls,
    ...sitemapUrls,
  ];
  const pages = selectPages(candidates, host, home);

  // Read the selected pages through the browser engine, in parallel.
  const secondary = await Promise.all(pages.map((u) => jinaRead(u, true)));

  const parts = [homeText, ...secondary]
    .filter((t): t is string => Boolean(t))
    .map((t) => t.slice(0, MAX_PAGE_CHARS));
  if (parts.length === 0) return null;

  const combined = parts.join("\n\n---\n\n").slice(0, MAX_TOTAL_CHARS).trim();
  return combined || null;
}

/** Read one URL as markdown via Jina. `browser` renders JS + evades bot walls. */
async function jinaRead(target: string, browser: boolean): Promise<string | null> {
  const headers: Record<string, string> = { Accept: "text/plain", "X-Timeout": "10" };
  const key = env.jinaApiKey();
  if (key) headers.Authorization = `Bearer ${key}`;
  if (browser) headers["X-Engine"] = "browser";
  try {
    const res = await fetch(`https://r.jina.ai/${target}`, {
      headers,
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    return text || null;
  } catch {
    return null;
  }
}

/** Same-host absolute URLs referenced from a markdown page. */
function extractLinks(markdown: string, host: string): string[] {
  const urls = new Set<string>();
  const re = /\((https?:\/\/[^)\s]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    try {
      const u = new URL(m[1]);
      if (sameHost(u.hostname, host)) urls.add(stripHash(u));
    } catch {
      // skip malformed
    }
  }
  return [...urls];
}

/** <loc> entries from /sitemap.xml (best-effort; index or urlset alike). */
async function fetchSitemapUrls(host: string): Promise<string[]> {
  try {
    const res = await fetch(`https://${host}/sitemap.xml`, {
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((x) => x[1]);
  } catch {
    return [];
  }
}

/** Post/entry links from the first RSS/Atom feed that answers (best-effort). */
async function fetchFeedUrls(host: string): Promise<string[]> {
  for (const path of ["/feed", "/rss", "/feed.xml", "/rss.xml"]) {
    try {
      const res = await fetch(`https://${host}${path}`, {
        headers: { "user-agent": UA },
        signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const rss = [...xml.matchAll(/<link>\s*([^<]+?)\s*<\/link>/g)].map((m) => m[1]);
      const atom = [...xml.matchAll(/<link[^>]*href="([^"]+)"/g)].map((m) => m[1]);
      const links = [...rss, ...atom].filter((u) => /^https?:\/\//.test(u));
      if (links.length > 0) return links;
    } catch {
      // try next path
    }
  }
  return [];
}

/** Rank candidates by signal, drop junk, and take the best few. */
function selectPages(candidates: string[], host: string, homeUrl: string): string[] {
  const seen = new Set([homeUrl.replace(/\/$/, "")]);
  const scored: { url: string; score: number }[] = [];

  for (const raw of candidates) {
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      continue;
    }
    if (!sameHost(u.hostname, host)) continue;

    const url = stripHash(u);
    const key = url.replace(/\/$/, "");
    if (seen.has(key)) continue;

    const low = url.toLowerCase();
    if (EXCLUDE.some((x) => low.includes(x))) continue;
    if (/\.(png|jpe?g|gif|svg|webp|ico|pdf|zip|mp4|mp3|css|js|xml)(\?|$)/i.test(low)) continue;

    seen.add(key);
    let score = 0;
    SIGNAL.forEach((kw, i) => {
      if (low.includes(kw)) score += SIGNAL.length - i;
    });
    scored.push({ url, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_PAGES - 1).map((s) => s.url);
}

function sameHost(hostname: string, host: string): boolean {
  const a = hostname.replace(/^www\./, "");
  const b = host.replace(/^www\./, "");
  return a === b;
}

function stripHash(u: URL): string {
  u.hash = "";
  return u.toString();
}

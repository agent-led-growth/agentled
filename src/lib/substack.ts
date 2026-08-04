import "server-only";

const FEED_URL = "https://agentledco.substack.com/feed";
export const SUBSTACK_URL = "https://agentledco.substack.com";

export type SubstackPost = {
  title: string;
  link: string;
  date: string;
  description: string;
  image: string;
  author: string;
};

/**
 * Latest posts from the Agent-led Growth Substack RSS feed, with subtitle,
 * cover image and author. Cached for a day (we publish ~weekly). Cover URLs are
 * rewritten to small Substack-CDN thumbnails (a few KB each). Failures return an
 * empty list so /home degrades gracefully. Parsed with a small focused RSS
 * reader since Cloudflare's workerd has no DOMParser.
 */
export async function getSubstackPosts(limit = 5): Promise<SubstackPost[]> {
  try {
    const res = await fetch(FEED_URL, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; agentled.co RSS)" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseItems(xml)
      .filter((p) => p.title && p.link)
      .slice(0, limit);
  } catch {
    return [];
  }
}

function parseItems(xml: string): SubstackPost[] {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return blocks.map((block) => ({
    title: clean(tag(block, "title")),
    link: tag(block, "link"),
    date: formatDate(tag(block, "pubDate")),
    description: clean(tag(block, "description")),
    image: cdnResize(attr(block, "enclosure", "url"), 400),
    author: clean(tag(block, "dc:creator")),
  }));
}

function tag(block: string, name: string): string {
  const m = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`).exec(block);
  if (!m) return "";
  let v = m[1].trim();
  const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(v);
  if (cdata) v = cdata[1].trim();
  return v;
}

function attr(block: string, tagName: string, attrName: string): string {
  const m = new RegExp(`<${tagName}\\b[^>]*\\b${attrName}="([^"]*)"`).exec(block);
  return m ? m[1] : "";
}

/** Rewrite a signed full-size Substack-CDN URL to an unsigned resized one. */
function cdnResize(url: string, width: number): string {
  const marker = "/image/fetch/";
  const i = url.indexOf(marker);
  if (i === -1) return url;
  const rest = url.slice(i + marker.length);
  const slash = rest.indexOf("/");
  if (slash === -1) return url;
  const original = rest.slice(slash + 1);
  return `https://substackcdn.com/image/fetch/w_${width},c_limit,f_auto,q_auto:good/${original}`;
}

function clean(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => codePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => codePoint(Number(n)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function codePoint(n: number): string {
  try {
    return String.fromCodePoint(n);
  } catch {
    return "";
  }
}

function formatDate(pubDate: string): string {
  if (!pubDate) return "";
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

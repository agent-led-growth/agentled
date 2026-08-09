import "server-only";

import { env } from "@/lib/env";

/**
 * Reader (step 2): fetch a site as clean markdown via Jina Reader — prepend
 * `r.jina.ai/` to the URL. Keyless works from residential IPs but Jina refuses
 * Cloudflare's datacenter egress, so in production we authenticate with
 * `JINA_API_KEY`. Swappable slot: point this at Firecrawl if JS-heavy sites need
 * a different renderer.
 */

const MAX_CHARS = 12_000; // enough context for enrichment without blowing tokens
const TIMEOUT_MS = 12_000;

/** Clean text content for `host`, or null if the site can't be read. */
export async function readSiteContent(host: string): Promise<string | null> {
  const target = `https://${host}`;
  const headers: Record<string, string> = { Accept: "text/plain" };
  const jinaKey = env.jinaApiKey();
  if (jinaKey) headers.Authorization = `Bearer ${jinaKey}`;
  try {
    const res = await fetch(`https://r.jina.ai/${target}`, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    return text ? text.slice(0, MAX_CHARS) : null;
  } catch {
    // Timeout, DNS failure, unreachable — enrichment falls back to domain-only.
    return null;
  }
}

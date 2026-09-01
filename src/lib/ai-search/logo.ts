import "server-only";

/**
 * Logo (step 2): deterministic, no model, no paid API. Fetch the site's raw
 * HTML and pull `og:image` / `apple-touch-icon` / an icon `<link>`, resolving
 * relative URLs; fall back to `/favicon.ico` by convention. Swappable slot: a
 * logo API (Logo.dev, Brandfetch) could replace this later.
 */

const TIMEOUT_MS = 8_000;

export async function detectLogo(host: string): Promise<string | null> {
  const base = `https://${host}`;
  try {
    const res = await fetch(base, {
      headers: { Accept: "text/html" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) {
      const html = await res.text();
      const found = extractLogoFromHtml(html, base);
      if (found) return found;
    }
  } catch {
    // Unreachable page — fall through to the favicon convention.
  }
  return `${base}/favicon.ico`;
}

function extractLogoFromHtml(html: string, base: string): string | null {
  const head = html.slice(0, 100_000); // logos live in <head>; cap the scan

  const og =
    firstGroup(head, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    firstGroup(head, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (og) return absolutize(og, base);

  const apple =
    firstGroup(head, /<link[^>]+rel=["']apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i) ??
    firstGroup(head, /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon[^"']*["']/i);
  if (apple) return absolutize(apple, base);

  const icon = firstGroup(
    head,
    /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i,
  );
  if (icon) return absolutize(icon, base);

  return null;
}

function firstGroup(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m?.[1] ?? null;
}

function absolutize(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

import type { MetadataRoute } from "next";

import { SITE } from "@/lib/site";

/**
 * AI crawlers are allowed deliberately.
 *
 * Being cited by answer engines is the point of this site, so GPTBot,
 * ClaudeBot, PerplexityBot and friends are welcome. Blocking them is the
 * default advice for publishers protecting paid content — the opposite of what
 * we want here. Revisit only if we start publishing gated material.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Nothing here is useful to a crawler and /subscribed is noindex anyway.
        disallow: ["/api/", "/subscribed"],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}

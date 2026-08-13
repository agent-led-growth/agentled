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
        // No blanket `Allow: /` on purpose: everything is crawlable by default,
        // so the public marketing pages — "/", "/ai-search" and their "/es"
        // variants — stay open, while the disallows below are unambiguous for
        // every parser (a leading `Allow: /` would let first-match crawlers
        // skip the disallows entirely). None of these paths is a prefix of a
        // landing, so no landing is shadowed.
        //
        // Gated / transactional pages: no crawl value, so keep them out of
        // crawl budget. They are already noindex; this just stops bots
        // fetching them at all.
        disallow: [
          "/api/",
          "/subscribed",
          "/home",
          "/account",
          "/ai-search/onboarding",
          "/ai-search/dashboard",
        ],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}

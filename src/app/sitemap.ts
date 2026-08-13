import type { MetadataRoute } from "next";

import { PATHS } from "@/lib/metadata";
import { SITE } from "@/lib/site";

/** Absolute URL for a route path (root has no trailing segment). */
const abs = (path: string) => `${SITE.url}${path === "/" ? "" : path}`;

// `lastModified` is a real content date (YYYY-MM-DD), not build time: using
// `new Date()` would reset every timestamp on every deploy and teach crawlers
// to distrust lastmod. Bump a page's date when the components that render it
// change — for `home` that's Hero + Faq + FAQ_ITEMS, for `aiSearch` the
// AiSearchLanding + AI_SEARCH_FAQ_ITEMS. Both locales of a page share one date
// on purpose: EN and ES render the same components, so their content changes
// together.
const PAGES = [
  {
    paths: PATHS.home,
    lastModified: "2026-08-13",
    priority: 1,
    changeFrequency: "weekly" as const,
  },
  {
    paths: PATHS.aiSearch,
    lastModified: "2026-08-13",
    priority: 0.8,
    changeFrequency: "monthly" as const,
  },
];

export default function sitemap(): MetadataRoute.Sitemap {
  // One entry per locale per page, each carrying the full hreflang set so
  // Google pairs the language versions.
  return PAGES.flatMap((page) =>
    (["en", "es"] as const).map((locale) => ({
      url: abs(page.paths[locale]),
      lastModified: page.lastModified,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: {
        languages: {
          en: abs(page.paths.en),
          es: abs(page.paths.es),
          "x-default": abs(page.paths.en),
        },
      },
    })),
  );
}

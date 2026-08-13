import type { MetadataRoute } from "next";

import { PATHS } from "@/lib/metadata";
import { SITE } from "@/lib/site";

/** Absolute URL for a route path (root has no trailing segment). */
const abs = (path: string) => `${SITE.url}${path === "/" ? "" : path}`;

// `lastModified` is a real content date, not build time — bump a page's date
// only when its content meaningfully changes. Using `new Date()` here would
// reset every timestamp on every deploy and teach crawlers to distrust it.
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

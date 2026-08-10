import type { MetadataRoute } from "next";

import { PATHS } from "@/lib/metadata";
import { SITE } from "@/lib/site";

/** Absolute URL for a route path (root has no trailing segment). */
const abs = (path: string) => `${SITE.url}${path === "/" ? "" : path}`;

const PAGES = [
  { paths: PATHS.home, priority: 1, changeFrequency: "weekly" as const },
  { paths: PATHS.aiSearch, priority: 0.8, changeFrequency: "monthly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  // One entry per locale per page, each carrying the full hreflang set so
  // Google pairs the language versions.
  return PAGES.flatMap((page) =>
    (["en", "es"] as const).map((locale) => ({
      url: abs(page.paths[locale]),
      lastModified,
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

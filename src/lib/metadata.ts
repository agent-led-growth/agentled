import type { Metadata, Viewport } from "next";

import { getDictionary, type Locale } from "@/lib/i18n";
import { OG_IMAGES, SITE } from "@/lib/site";

const OG_LOCALE: Record<Locale, string> = { en: "en_US", es: "es_ES" };

/** A page's canonical path in each locale. Drives canonical + hreflang. */
export type LocalePaths = { en: string; es: string };

/** Canonical paths for the localized marketing pages. */
export const PATHS = {
  home: { en: "/", es: "/es" },
  aiSearch: { en: "/ai-search", es: "/es/ai-search" },
  pricing: { en: "/ai-search/pricing", es: "/es/ai-search/pricing" },
} as const satisfies Record<string, LocalePaths>;

/**
 * Gated / app routes: noindex, and kept out of crawl budget. Single source of
 * truth — `robots.ts` derives its Disallow list from this, and every page here
 * sets `robots: NOINDEX` in its metadata. Add a route here (and spread NOINDEX
 * in its page) whenever it must not be indexed or crawled, so the two never
 * drift apart.
 *
 * Safe to Disallow despite being noindex: none has a crawlable inbound link
 * (they are reached via client-side redirects / router.push, never an
 * `<a href>`), so none is in the index for a Disallow to strand. Were that to
 * change for a route, keep it crawlable+noindex until it drops out, then add it
 * here.
 */
export const GATED_PATHS = [
  "/home",
  "/account",
  "/subscribed",
  "/ai-search/onboarding",
  "/ai-search/dashboard",
] as const;

/** Shared robots directive for the pages listed in GATED_PATHS. */
export const NOINDEX: Metadata["robots"] = { index: false, follow: false };

/**
 * Per-page `alternates`: self-canonical for `current`, plus a reciprocal
 * hreflang set (both languages + x-default → English). Every localized page
 * must set this so Google pairs the right-language URLs.
 */
export function hreflang(
  paths: LocalePaths,
  current: Locale,
): Metadata["alternates"] {
  return {
    canonical: paths[current],
    languages: {
      en: paths.en,
      es: paths.es,
      "x-default": paths.en,
    },
  };
}

/**
 * Root-layout metadata for a locale — title/description/OpenGraph/robots,
 * shared by both language root layouts so they cannot drift. Alternates are
 * deliberately omitted: hreflang is set per page via `hreflang()`.
 */
export function buildRootMetadata(locale: Locale): Metadata {
  const m = getDictionary(locale).meta;
  const url = locale === "en" ? SITE.url : `${SITE.url}/${locale}`;
  return {
    metadataBase: new URL(SITE.url),
    title: {
      default: m.siteTitle,
      // Secondary pages get "<page> — Agent-led Growth" without repeating it.
      template: `%s — ${SITE.name}`,
    },
    description: m.siteDescription,
    applicationName: SITE.name,
    authors: [{ name: SITE.founder.name, url: SITE.founder.linkedin }],
    creator: SITE.founder.name,
    publisher: SITE.legalName,
    openGraph: {
      title: m.siteTitle,
      description: m.siteSocialDescription,
      url,
      siteName: SITE.name,
      locale: OG_LOCALE[locale],
      type: "website",
      images: OG_IMAGES,
    },
    twitter: {
      card: "summary_large_image",
      title: m.siteTitle,
      description: m.siteSocialDescription,
      images: OG_IMAGES,
      creator: "@hsantana8",
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    category: "technology",
  };
}

export const rootViewport: Viewport = {
  themeColor: [
    // Unconditional entry first: Discord and some scrapers read the plain
    // theme-color for their embed accent and ignore media-scoped ones.
    { color: "#0b0d0c" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d0c" },
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
  ],
};

import type { Metadata, Viewport } from "next";

import { RootHtml } from "@/components/layout/root-html";
import { OG_IMAGES, SITE } from "@/lib/site";

import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: SITE.title,
    // Secondary pages get "<page> — Agent-led Growth" without repeating it.
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.founder.name, url: SITE.founder.linkedin }],
  creator: SITE.founder.name,
  publisher: SITE.legalName,
  alternates: { canonical: "/" },
  openGraph: {
    title: SITE.title,
    description: SITE.socialDescription,
    url: SITE.url,
    siteName: SITE.name,
    locale: "en_US",
    type: "website",
    images: OG_IMAGES,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.title,
    description: SITE.socialDescription,
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

export const viewport: Viewport = {
  themeColor: [
    // Unconditional entry first: Discord and some scrapers read the plain
    // theme-color for their embed accent and ignore media-scoped ones.
    { color: "#0b0d0c" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d0c" },
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
  ],
};

export default function EnRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <RootHtml lang="en">{children}</RootHtml>;
}

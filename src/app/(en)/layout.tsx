import { RootHtml } from "@/components/layout/root-html";
import { buildRootMetadata, rootViewport } from "@/lib/metadata";

import "../globals.css";

// Canonical + hreflang are set per page (see hreflang() in @/lib/metadata),
// not here — the alternates differ per route.
export const metadata = buildRootMetadata("en");
export const viewport = rootViewport;

export default function EnRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <RootHtml lang="en">{children}</RootHtml>;
}

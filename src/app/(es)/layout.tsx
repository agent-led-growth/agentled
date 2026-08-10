import { RootHtml } from "@/components/layout/root-html";
import { buildRootMetadata, rootViewport } from "@/lib/metadata";

import "../globals.css";

// Spanish root layout. Shares all scaffolding with the English one via
// RootHtml; only `lang` and the localized metadata differ. Canonical +
// hreflang are set per page.
export const metadata = buildRootMetadata("es");
export const viewport = rootViewport;

export default function EsRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <RootHtml lang="es">{children}</RootHtml>;
}

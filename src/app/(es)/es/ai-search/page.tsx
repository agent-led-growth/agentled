import type { Metadata } from "next";

import { AiSearchLanding } from "@/components/ai-search/landing";
import { getDictionary } from "@/lib/i18n";
import { hreflang, PATHS } from "@/lib/metadata";
import { OG_IMAGES } from "@/lib/site";

const m = getDictionary("es").meta.aiSearch;

export const metadata: Metadata = {
  title: m.title,
  description: m.description,
  alternates: hreflang(PATHS.aiSearch, "es"),
  openGraph: {
    title: m.ogTitle,
    description: m.ogDescription,
    url: PATHS.aiSearch.es,
    type: "website",
    images: OG_IMAGES,
  },
};

export default function AiSearchLandingEs() {
  return <AiSearchLanding locale="es" />;
}

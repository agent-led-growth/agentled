import type { Metadata } from "next";

import { PricingPage } from "@/components/pricing/pricing-page";
import { getDictionary } from "@/lib/i18n";
import { hreflang, PATHS } from "@/lib/metadata";
import { OG_IMAGES } from "@/lib/site";

const m = getDictionary("es").meta.pricing;

export const metadata: Metadata = {
  title: m.title,
  description: m.description,
  alternates: hreflang(PATHS.pricing, "es"),
  openGraph: {
    title: m.title,
    description: m.description,
    url: PATHS.pricing.es,
    type: "website",
    images: OG_IMAGES,
  },
};

export default function PricingEs() {
  return <PricingPage locale="es" />;
}

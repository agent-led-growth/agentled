import type { Metadata } from "next";

import { RedirectSignedIn } from "@/components/auth/redirect-signed-in";
import { Faq } from "@/components/faq";
import { FAQ_ITEMS } from "@/components/faq-content";
import { Hero } from "@/components/hero/hero";
import { SiteFooter } from "@/components/site-footer";
import { StructuredData } from "@/components/structured-data";
import { getDictionary } from "@/lib/i18n";
import { hreflang, PATHS } from "@/lib/metadata";

export const metadata: Metadata = {
  alternates: hreflang(PATHS.home, "en"),
};

export default function Home() {
  return (
    <>
      <RedirectSignedIn scanned="/ai-search/dashboard" notScanned="/home" />
      <StructuredData locale="en" path={PATHS.home.en} faqItems={FAQ_ITEMS} />
      <Hero />
      <Faq />
      <SiteFooter
        languageSwitch={{
          href: PATHS.home.es,
          label: getDictionary("en").footer.switchLabel,
        }}
      />
    </>
  );
}

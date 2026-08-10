import type { Metadata } from "next";

import { RedirectSignedIn } from "@/components/auth/redirect-signed-in";
import { Faq } from "@/components/faq";
import { FAQ_ITEMS_ES } from "@/components/faq-content.es";
import { Hero } from "@/components/hero/hero";
import { SiteFooter } from "@/components/site-footer";
import { getDictionary } from "@/lib/i18n";
import { hreflang, PATHS } from "@/lib/metadata";

export const metadata: Metadata = {
  alternates: hreflang(PATHS.home, "es"),
};

export default function HomeEs() {
  return (
    <>
      <RedirectSignedIn scanned="/ai-search/dashboard" notScanned="/home" />
      <Hero locale="es" />
      <Faq items={FAQ_ITEMS_ES} locale="es" />
      <SiteFooter
        languageSwitch={{
          href: PATHS.home.en,
          label: getDictionary("es").footer.switchLabel,
        }}
      />
    </>
  );
}

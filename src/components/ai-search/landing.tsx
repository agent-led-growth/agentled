import { Faq } from "@/components/faq";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getDictionary, type Locale } from "@/lib/i18n";
import { PATHS } from "@/lib/metadata";

import { AI_SEARCH_FAQ_ITEMS } from "./faq-content";
import { AI_SEARCH_FAQ_ITEMS_ES } from "./faq-content.es";
import { ModelMarks } from "./model-marks";
import { RedirectIfScanned } from "./redirect-if-scanned";
import { ScanForm } from "./scan-form";
import { MONO, marketingTokens } from "./tokens";
import { WaveCanvas } from "./wave-canvas";

const FAQ_ITEMS = {
  en: AI_SEARCH_FAQ_ITEMS,
  es: AI_SEARCH_FAQ_ITEMS_ES,
} as const;

/**
 * The AI Search Monitor landing, shared by the English and Spanish routes.
 * All copy comes from the locale dictionary and FAQ content files, so the two
 * routes are the same markup rendered in two languages.
 */
export function AiSearchLanding({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).aiSearch;
  const other = locale === "en" ? "es" : "en";

  return (
    <>
      <RedirectIfScanned to="/ai-search/dashboard" />
      <section
        style={marketingTokens}
        className="relative min-h-[100svh] overflow-hidden"
      >
        <WaveCanvas />

        <div className="relative z-10 flex min-h-[100svh] flex-col">
          <SiteHeader />

          {/* Hero */}
          <div className="flex flex-1 items-center px-[26px] py-[40px] md:px-[56px] md:py-0">
            <div className="grid w-full items-center gap-[40px] md:grid-cols-[1fr_500px] md:gap-[60px]">
              <div className="flex max-w-[660px] flex-col gap-[26px] md:gap-[34px]">
                <h1
                  className="text-[42px] font-bold md:text-[82px]"
                  style={{
                    lineHeight: 0.94,
                    letterSpacing: "-0.055em",
                    textWrap: "pretty",
                  }}
                >
                  {t.headline}
                </h1>
                <p
                  className="max-w-[40ch] text-[17px] md:text-[21px]"
                  style={{ lineHeight: 1.45, color: "var(--muted)" }}
                >
                  {t.subhead}
                </p>

                <ScanForm />

                <div className="flex flex-col gap-[14px]">
                  <span
                    className="uppercase"
                    style={{
                      fontFamily: MONO,
                      fontSize: 10.5,
                      letterSpacing: "0.2em",
                      color: "var(--dim)",
                    }}
                  >
                    {t.modelsEyebrow}
                  </span>
                  <ModelMarks />
                </div>
              </div>

              {/* Right column — wave origin marker (desktop only) */}
              <div
                className="hidden md:grid"
                style={{ height: 620, placeItems: "center" }}
              >
                <span
                  className="uppercase"
                  style={{
                    fontFamily: MONO,
                    fontSize: 12,
                    letterSpacing: "0.2em",
                    color: "var(--signal)",
                  }}
                >
                  {t.brandMarker}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Faq items={FAQ_ITEMS[locale]} locale={locale} />
      <SiteFooter
        languageSwitch={{
          href: PATHS.aiSearch[other],
          label: getDictionary(locale).footer.switchLabel,
        }}
      />
    </>
  );
}

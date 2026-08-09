import type { Metadata } from "next";

import { AI_SEARCH_FAQ_ITEMS } from "@/components/ai-search/faq-content";
import { ModelMarks } from "@/components/ai-search/model-marks";
import { RedirectIfScanned } from "@/components/ai-search/redirect-if-scanned";
import { ScanForm } from "@/components/ai-search/scan-form";
import { MONO, marketingTokens } from "@/components/ai-search/tokens";
import { WaveCanvas } from "@/components/ai-search/wave-canvas";
import { Faq } from "@/components/faq";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getDictionary } from "@/lib/i18n";

const t = getDictionary("en").aiSearch;

export const metadata: Metadata = {
  title: "AI Search Monitor",
  description:
    "See how often AI assistants recommend your brand. Track your visibility across ChatGPT, Claude, Gemini, Perplexity and Copilot — and win more recommendations, traffic and leads.",
  alternates: { canonical: "/ai-search" },
  openGraph: {
    title: "AI Search Monitor — Does AI recommend your brand?",
    description:
      "Track how often AI assistants recommend your brand across ChatGPT, Claude, Gemini, Perplexity and Copilot.",
    url: "/ai-search",
    type: "website",
  },
};

export default function AiSearchLanding() {
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

      <Faq items={AI_SEARCH_FAQ_ITEMS} />
      <SiteFooter />
    </>
  );
}

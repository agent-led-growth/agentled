import { AI_SEARCH_FAQ_ITEMS } from "@/components/ai-search/faq-content";
import { AI_SEARCH_FAQ_ITEMS_ES } from "@/components/ai-search/faq-content.es";
import { Faq } from "@/components/faq";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getDictionary, type Locale } from "@/lib/i18n";
import { PATHS } from "@/lib/metadata";

import { PricingCards } from "./pricing-cards";

const FAQ_ITEMS = {
  en: AI_SEARCH_FAQ_ITEMS,
  es: AI_SEARCH_FAQ_ITEMS_ES,
} as const;

/**
 * The /pricing page, shared by the English and Spanish routes. Header + hero +
 * plan grid on the marketing `--surface`, then the shared FAQ accordion. The FAQ
 * is visual only here — the AI-search landing owns the FAQPage JSON-LD, so we
 * don't emit a duplicate set.
 */
export function PricingPage({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).pricing;

  return (
    <>
      <main className="min-h-[100svh] bg-[var(--surface)]">
        <SiteHeader languageToggle={{ locale, paths: PATHS.pricing }} />

        <div className="mx-auto flex max-w-[1120px] flex-col gap-[40px] px-[26px] pt-[36px] pb-[56px] md:gap-[56px] md:px-[64px] md:pt-[60px] md:pb-[100px]">
          <header className="flex max-w-[720px] flex-col gap-[16px]">
            <p className="font-mono text-[10.5px] tracking-[0.2em] text-[var(--text-faint)] uppercase md:text-[12px]">
              {t.eyebrow}
            </p>
            <h1 className="text-[clamp(34px,4.6vw,56px)] leading-[0.98] font-bold tracking-[-0.045em] text-[var(--text-primary)]">
              {t.headline}
            </h1>
            <p className="max-w-[52ch] text-[16px] leading-[1.5] text-[var(--text-muted)] md:text-[18px]">
              {t.subhead}
            </p>
          </header>

          <PricingCards copy={t} locale={locale} />
        </div>
      </main>

      <Faq items={FAQ_ITEMS[locale]} locale={locale} />
      <SiteFooter locale={locale} />
    </>
  );
}

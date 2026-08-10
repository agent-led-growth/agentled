import { OtpForm } from "@/components/auth/otp-form";
import { SiteHeader } from "@/components/site-header";
import { getDictionary, type Locale } from "@/lib/i18n";
import { PATHS } from "@/lib/metadata";

import { CtaChip } from "./cta-chip";
import { SocialProof } from "./social-proof";
import { TracesCanvas } from "./traces-canvas";

/**
 * Single-viewport hero.
 *
 * Shared header on top (lockup ↔ sign in). Desktop: copy block pinned to the
 * bottom-left, the tool CTA in the bottom-right corner. Mobile: copy block
 * centred; the `pb-[104px]` lifts it so the Subscribe button lands on the
 * vertical centre line.
 */
export function Hero({ locale = "en" }: { locale?: Locale }) {
  const t = getDictionary(locale).hero;
  return (
    <section className="relative flex min-h-[100svh] flex-col overflow-hidden bg-[var(--surface)]">
      <TracesCanvas />

      <div className="relative flex flex-1 flex-col">
        <SiteHeader languageToggle={{ locale, paths: PATHS.home }} />

        <div className="flex flex-1 flex-col px-[26px] pb-[34px] md:px-[56px] md:pb-[64px]">
          {/* Copy block. translate-y on mobile drops it off the header;
              desktop is bottom-pinned. */}
          <div className="my-auto flex max-w-[700px] translate-y-[20px] flex-col gap-[20px] pb-[104px] md:mt-auto md:mb-0 md:translate-y-0 md:gap-[30px] md:pb-[34px]">
            <h1 className="max-w-[11ch] text-[clamp(50px,7.2vw,92px)] leading-[0.95] font-bold tracking-[-0.055em] text-[var(--text-primary)]">
              {t.headline}
            </h1>
            <p className="max-w-[36ch] text-[17px] leading-[1.5] text-[var(--text-muted)] md:text-[23px] md:leading-[1.45]">
              {t.subhead}
            </p>
            <OtpForm
              submitLabel={t.subscribe}
              redirectTo="/home"
              source="hero"
            />
            <SocialProof locale={locale} />
          </div>
        </div>

        {/* Tool CTA, bottom-right corner of the landing. */}
        <div className="absolute right-[26px] bottom-[34px] md:right-[56px] md:bottom-[64px]">
          <CtaChip label={t.ctaChip} />
        </div>
      </div>
    </section>
  );
}

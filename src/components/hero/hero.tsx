import { ThemeToggle } from "@/components/theme-toggle";

import { CtaChip } from "./cta-chip";
import { Lockup } from "./lockup";
import { SocialProof } from "./social-proof";
import { SubscribeForm } from "./subscribe-form";
import { TracesCanvas } from "./traces-canvas";

/**
 * Single-viewport hero (designs 4A/4B).
 *
 * Desktop: top row is lockup ↔ CTA, copy block pinned to the bottom.
 * Mobile: lockup, then the copy block centred in the free space, with the CTA
 * chip last. The `pb-[104px]` on mobile is load-bearing — it lifts the block so
 * the Subscribe button lands on the vertical centre line, per the handoff.
 */
export function Hero() {
  return (
    <section className="relative flex min-h-[100svh] flex-col overflow-hidden bg-[var(--surface)]">
      <TracesCanvas />

      <div className="relative flex flex-1 flex-col px-[26px] pt-[26px] pb-[34px] md:px-[56px] md:pt-[44px] md:pr-[56px] md:pb-[64px] md:pl-[64px]">
        {/* Top row */}
        <div className="flex items-center justify-between gap-[16px] md:gap-[40px]">
          <Lockup />
          <div className="flex items-center gap-[10px] md:gap-[14px]">
            <ThemeToggle />
            {/* Visibility lives on a wrapper: putting `hidden` on the chip
                itself collides with its own `inline-flex` utility. */}
            <div className="hidden md:block">
              <CtaChip />
            </div>
          </div>
        </div>

        {/* Copy block */}
        <div className="my-auto flex max-w-[700px] flex-col gap-[20px] pb-[104px] md:mt-auto md:mb-0 md:gap-[30px] md:pb-[34px]">
          <h1 className="max-w-[11ch] text-[clamp(50px,7.2vw,92px)] leading-[0.95] font-bold tracking-[-0.055em] text-[var(--text-primary)]">
            Grow in the Age of AI
          </h1>
          <p className="max-w-[36ch] text-[17px] leading-[1.5] text-[var(--text-muted)] md:text-[23px] md:leading-[1.45]">
            Get research, experiments, and tools for the next generation of
            growth.
          </p>
          <SubscribeForm />
          <SocialProof />
        </div>

        {/* Mobile-only CTA, at the bottom of the column */}
        <div className="self-start md:hidden">
          <CtaChip />
        </div>
      </div>
    </section>
  );
}

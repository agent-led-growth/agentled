import Link from "next/link";

import { Lockup } from "@/components/hero/lockup";
import { SiteFooter } from "@/components/site-footer";

/** Prose frame for long-form legal pages (Privacy, Terms). Top-aligned and
 *  width-capped for readability, unlike the vertically-centred PageShell. */
export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <main className="min-h-[100svh] bg-[var(--surface)] px-[26px] pt-[26px] pb-[48px] md:px-[64px] md:pt-[44px] md:pb-[80px]">
        <div className="flex items-center gap-[16px]">
          <Link href="/" aria-label="Agent-led Growth — home">
            <Lockup />
          </Link>
        </div>

        <div className="mx-auto mt-[40px] flex max-w-[720px] flex-col gap-[10px] md:mt-[56px]">
          <h1 className="text-[clamp(32px,4.4vw,52px)] leading-[1.0] font-bold tracking-[-0.04em] text-[var(--text-primary)]">
            {title}
          </h1>
          <p className="eyebrow text-[var(--text-faint)]">
            Last updated: {updated}
          </p>
        </div>

        <div className="legal-prose mx-auto mt-[32px] max-w-[720px] md:mt-[40px]">
          {children}
        </div>

        <div className="mx-auto mt-[48px] max-w-[720px]">
          <Link
            href="/"
            className="inline-block border border-[var(--border-hairline)] px-[20px] py-[12px] text-[15px] text-[var(--text-muted)] no-underline transition-colors hover:border-[var(--text-faint)] hover:text-[var(--text-primary)] md:text-[16px]"
          >
            ← Back to home
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

import Link from "next/link";

import { Lockup } from "@/components/hero/lockup";
import { SiteFooter } from "@/components/site-footer";

/** Minimal on-brand frame for the secondary routes. */
export function PageShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <main className="flex min-h-[100svh] flex-col bg-[var(--surface)] px-[26px] pt-[26px] pb-[34px] md:px-[64px] md:pt-[44px] md:pb-[64px]">
        <div className="flex items-center gap-[16px]">
          <Link href="/" aria-label="Agent-led Growth — home">
            <Lockup />
          </Link>
        </div>

        <div className="my-auto flex max-w-[700px] flex-col gap-[20px] md:gap-[26px]">
          <p className="font-mono text-[10.5px] tracking-[0.2em] text-[var(--text-faint)] uppercase md:text-[12px]">
            {eyebrow}
          </p>
          <h1 className="text-[clamp(40px,5.4vw,68px)] leading-[0.95] font-bold tracking-[-0.055em] text-[var(--text-primary)]">
            {title}
          </h1>
          {children}
        </div>

        <Link
          href="/"
          className="self-start border border-[var(--border-hairline)] px-[20px] py-[12px] text-[15px] text-[var(--text-muted)] no-underline transition-colors hover:border-[var(--text-faint)] hover:text-[var(--text-primary)] md:text-[16px]"
        >
          ← Back to home
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}

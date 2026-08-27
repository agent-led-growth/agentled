import type { Metadata } from "next";

import { ComparisonTable } from "@/components/open-source-comparison/table";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { OG_IMAGES } from "@/lib/site";

const DESCRIPTION =
  "See how PostHog, Supabase, n8n, Postiz, and Resend approach the practices that make open-source products easier for agents to discover, understand, use, run, and contribute to.";

export const metadata: Metadata = {
  title: "Open Source for Agents: Comparison",
  description: DESCRIPTION,
  alternates: { canonical: "/open-source-agent-readiness" },
  openGraph: {
    title: "Open Source for Agents: Comparison",
    description: DESCRIPTION,
    type: "article",
    images: OG_IMAGES,
  },
};

export default function OpenSourceAgentReadiness() {
  return (
    <div className="flex min-h-[100svh] flex-col bg-[var(--surface)]">
      <SiteHeader />

      <main className="flex-1 px-[26px] py-[48px] md:px-[56px] md:py-[64px]">
        <div className="mx-auto flex max-w-[900px] flex-col gap-[28px]">
          <header className="flex flex-col gap-[14px]">
            <h1 className="text-[30px] leading-[1.05] font-bold tracking-[-0.03em] text-[var(--text-primary)] md:text-[42px]">
              Open Source for Agents: Comparison
            </h1>
            <p className="max-w-[62ch] text-[16px] leading-[1.5] text-[var(--text-muted)] md:text-[18px]">
              See how PostHog, Supabase, n8n, Postiz, and Resend approach the
              practices that make open-source products easier for agents to
              discover, understand, use, run, and contribute to.
            </p>
          </header>

          <ComparisonTable />
        </div>
      </main>

      <SiteFooter locale="en" />
    </div>
  );
}

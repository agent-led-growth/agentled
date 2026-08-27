import type { Metadata } from "next";

import { OtpForm } from "@/components/auth/otp-form";
import { RedirectSignedInTo } from "@/components/auth/redirect-signed-in-to";
import { ProductLogos } from "@/components/open-source-comparison/product-logos";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/** The public, indexable comparison the gate redirects to after sign-in. */
const TABLE_PATH = "/open-source-agent-readiness";

export const metadata: Metadata = {
  title: "Open-Source Products Built for Agents",
  description:
    "Compare PostHog, Supabase, n8n, Postiz, and Resend across the practices that make open-source products easier for agents to discover, understand, use, and contribute to.",
  alternates: { canonical: "/open-source-comparison" },
};

export default function OpenSourceComparisonLanding() {
  return (
    <div className="flex min-h-[100svh] flex-col bg-[var(--surface)]">
      {/* Signed-in visitors skip the email step and go straight to the table;
          anonymous visitors (and crawlers) stay, so this landing renders
          statically and stays indexable. */}
      <RedirectSignedInTo to={TABLE_PATH} />
      <SiteHeader />

      <main className="flex flex-1 items-center px-[26px] py-[48px] md:px-[56px] md:py-[64px]">
        <div className="grid w-full items-center gap-[44px] md:grid-cols-2 md:gap-[64px]">
          {/* Left — copy + sign-in */}
          <div className="flex max-w-[560px] flex-col gap-[22px]">
            <h1 className="text-[34px] leading-[1.03] font-bold tracking-[-0.04em] text-[var(--text-primary)] md:text-[52px]">
              How open source wins with agents
            </h1>
            <p className="max-w-[46ch] text-[17px] leading-[1.5] text-[var(--text-muted)] md:text-[20px]">
              See how leading products make their repos agent-ready&hellip;
            </p>
            <OtpForm
              submitLabel="Get the comparison"
              redirectTo={TABLE_PATH}
              source="open-source-comparison"
            />
          </div>

          {/* Right — the compared product marks. On mobile the grid stacks, so
              this lands as a row below the form; on desktop it's centered in the
              empty right space (two lines, via the wall's max-width). */}
          <div className="flex justify-center">
            <ProductLogos />
          </div>
        </div>
      </main>

      <SiteFooter locale="en" />
    </div>
  );
}

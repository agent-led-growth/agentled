import type { Metadata } from "next";

import { PageShell } from "@/components/page-shell";

export const metadata: Metadata = {
  title: "AI Search Monitor — Agent-led Growth",
  description:
    "Track how AI assistants surface and describe your brand. Coming soon.",
};

/**
 * Placeholder. The real view is not designed yet — this exists so the hero CTA
 * lands somewhere on-brand instead of a 404.
 */
export default function AiSearchMonitorPage() {
  return (
    <PageShell eyebrow="Coming soon" title="AI Search Monitor">
      <p className="max-w-[46ch] text-[17px] leading-[1.5] text-[var(--text-muted)] md:text-[21px] md:leading-[1.45]">
        See how AI assistants find, cite, and describe your brand — and what to
        change when they get it wrong.
      </p>
      <p className="max-w-[46ch] text-[15px] leading-[1.5] text-[var(--text-faint)] md:text-[16px]">
        We&rsquo;re building it now. Subscribe on the home page and we&rsquo;ll
        tell you the moment it&rsquo;s ready.
      </p>
    </PageShell>
  );
}

import type { Metadata } from "next";

import { PageShell } from "@/components/page-shell";
import { OG_IMAGES } from "@/lib/site";

const description =
  "See how AI assistants like ChatGPT, Claude, and Gemini find, cite, and describe your brand — which competitors appear alongside you, and where you may be underrepresented.";

export const metadata: Metadata = {
  title: "AI Search Monitor",
  description,
  alternates: { canonical: "/ai-search-monitor" },
  openGraph: {
    title: "AI Search Monitor — Agent-led Growth",
    description,
    url: "/ai-search-monitor",
    type: "website",
    images: OG_IMAGES,
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Search Monitor — Agent-led Growth",
    description,
    images: OG_IMAGES,
  },
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

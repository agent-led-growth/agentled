import type { Metadata } from "next";

import { PageShell } from "@/components/page-shell";

export const metadata: Metadata = {
  title: "Subscription confirmed — Agent-led Growth",
  robots: { index: false },
};

const COPY = {
  ok: {
    eyebrow: "You're in",
    title: "Subscription confirmed",
    body: "You'll get research, experiments, and tools for the next generation of growth. No noise.",
  },
  invalid: {
    eyebrow: "Link problem",
    title: "That link isn't valid",
    body: "It may have already been used, or been copied incompletely. Try subscribing again from the home page.",
  },
  error: {
    eyebrow: "Something broke",
    title: "We couldn't confirm that",
    body: "Something went wrong on our end. Please try the link again in a moment.",
  },
} as const;

type Status = keyof typeof COPY;

export default async function SubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const key: Status =
    status === "ok" || status === "invalid" || status === "error"
      ? status
      : "invalid";
  const copy = COPY[key];

  return (
    <PageShell eyebrow={copy.eyebrow} title={copy.title}>
      <p className="max-w-[46ch] text-[17px] leading-[1.5] text-[var(--text-muted)] md:text-[21px] md:leading-[1.45]">
        {copy.body}
      </p>
    </PageShell>
  );
}

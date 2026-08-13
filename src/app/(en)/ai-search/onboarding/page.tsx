import type { Metadata } from "next";

import { OnboardingFlow } from "@/components/ai-search/onboarding-flow";
import { NOINDEX } from "@/lib/metadata";

export const metadata: Metadata = {
  title: "Set up your monitor",
  robots: NOINDEX,
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const { url } = await searchParams;
  // No url (direct visit / "+ New brand") → empty field with a placeholder; the
  // Brief step won't let you continue until you enter one.
  return <OnboardingFlow initialUrl={url?.trim() || ""} />;
}

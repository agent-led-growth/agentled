import type { Metadata } from "next";

import { BRAND } from "@/components/ai-search/fixtures";
import { OnboardingFlow } from "@/components/ai-search/onboarding-flow";

export const metadata: Metadata = {
  title: "Set up your monitor",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const { url } = await searchParams;
  return <OnboardingFlow initialUrl={url?.trim() || BRAND.url} />;
}

import type { Metadata } from "next";
import { Suspense } from "react";

import { Dashboard } from "@/components/ai-search/dashboard";
import { NOINDEX } from "@/lib/metadata";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: NOINDEX,
};

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <Dashboard />
    </Suspense>
  );
}

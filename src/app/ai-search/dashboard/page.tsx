import type { Metadata } from "next";
import { Suspense } from "react";

import { Dashboard } from "@/components/ai-search/dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <Dashboard />
    </Suspense>
  );
}

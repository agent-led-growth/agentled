"use client";

import { useRouter } from "next/navigation";

import { useWhenSignedIn } from "./use-when-signed-in";

/**
 * Routes signed-in visitors away from the root landing: those who've already
 * scanned go straight to the dashboard, the rest to /home. Anonymous visitors
 * stay and never hit the API (the session check is local), so the landing keeps
 * rendering statically for crawlers.
 */
export function RedirectSignedIn({
  scanned,
  notScanned,
}: {
  scanned: string;
  notScanned: string;
}) {
  const router = useRouter();

  useWhenSignedIn(async (isActive) => {
    try {
      const res = await fetch("/api/ai-search/status");
      const json = (await res.json()) as { hasScanned?: boolean };
      if (isActive()) router.replace(json.hasScanned ? scanned : notScanned);
    } catch {
      if (isActive()) router.replace(notScanned); // API error — fall back home
    }
  });

  return null;
}

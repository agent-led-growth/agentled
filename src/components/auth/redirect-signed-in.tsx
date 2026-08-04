"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";

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

  useEffect(() => {
    let active = true;
    createClient()
      .auth.getSession()
      .then(async ({ data }) => {
        if (!data.session) return; // anonymous — stay on the landing
        try {
          const res = await fetch("/api/ai-search/status");
          const json = (await res.json()) as { hasScanned?: boolean };
          if (active) router.replace(json.hasScanned ? scanned : notScanned);
        } catch {
          if (active) router.replace(notScanned); // API error — fall back home
        }
      });
    return () => {
      active = false;
    };
  }, [router, scanned, notScanned]);

  return null;
}

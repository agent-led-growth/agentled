"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Redirects a signed-in user who has already run a scan away from the
 * /ai-search landing to `to`. Signed-in-but-not-scanned users stay (so they can
 * run their first scan); anonymous visitors never hit the API (the session
 * check is local), keeping the landing statically rendered.
 */
export function RedirectIfScanned({ to }: { to: string }) {
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
          if (active && json.hasScanned) router.replace(to);
        } catch {
          // Network/API error — stay on the page.
        }
      });
    return () => {
      active = false;
    };
  }, [router, to]);

  return null;
}

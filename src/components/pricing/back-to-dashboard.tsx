"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * "Back to dashboard" affordance on the marketing pricing page, shown between the
 * plan grid and the FAQ. Only rendered for signed-in visitors — they're the ones
 * with a dashboard (e.g. arriving from the in-app "Show plans" modals). A client
 * session check keeps the page statically rendered for logged-out / SEO traffic.
 */
export function BackToDashboard({ label }: { label: string }) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (active) setSignedIn(Boolean(data.session));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!signedIn) return null;
  return (
    <div className="flex justify-center">
      <Link
        href="/ai-search/dashboard"
        className="inline-flex items-center gap-[8px] text-[14px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
      >
        <span aria-hidden="true">←</span>
        {label}
      </Link>
    </div>
  );
}

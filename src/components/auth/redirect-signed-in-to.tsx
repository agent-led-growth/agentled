"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Sends signed-in visitors to `to`; anonymous visitors (and crawlers) stay put,
 * so the host page still renders statically and stays indexable. The session
 * check is local (getSession), so anonymous visitors never hit the network.
 *
 * A single-destination sibling of RedirectSignedIn (which additionally forks on
 * whether the user has scanned). Used by the comparison landing to route an
 * already-signed-in visitor straight to the public table with no email step.
 */
export function RedirectSignedInTo({ to }: { to: string }) {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (active && data.session) router.replace(to);
      });
    return () => {
      active = false;
    };
  }, [router, to]);

  return null;
}

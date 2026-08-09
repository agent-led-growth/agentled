"use client";

import { useEffect } from "react";

import { identifyUser, resetUser } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";

/**
 * Keeps PostHog's identity in sync with the Supabase session on every page.
 *
 * `onAuthStateChange` fires INITIAL_SESSION on subscribe, so an already-signed-in
 * visitor is identified on load; SIGNED_OUT resets. A *fresh* sign-in comes
 * through our server route (not the browser client) and does not emit an event
 * here — OtpForm identifies explicitly for that path. Renders nothing.
 */
export function PostHogAuth() {
  useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        identifyUser(session.user.id, session.user.email ?? undefined);
      } else if (event === "SIGNED_OUT") {
        resetUser();
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return null;
}

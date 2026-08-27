"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Runs `onSignedIn` once, on mount, if the visitor has a local session. The
 * check is local (getSession), so anonymous visitors (and crawlers) never hit
 * the network and the host page stays static/indexable. The handler receives an
 * `isActive()` probe so an async handler can skip a navigation after unmount.
 *
 * Shared by RedirectSignedIn and RedirectSignedInTo so the session-gate lives in
 * one place. The latest handler is always called (held in a ref), so callers can
 * pass an inline closure without retriggering the session check.
 */
export function useWhenSignedIn(onSignedIn: (isActive: () => boolean) => void): void {
  // Keep the latest handler in a ref (updated in an effect, never during render)
  // so the session check below can stay a one-shot mount effect while still
  // calling an inline closure that captures fresh props.
  const handler = useRef(onSignedIn);
  useEffect(() => {
    handler.current = onSignedIn;
  });

  useEffect(() => {
    let active = true;
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (active && data.session) handler.current(() => active);
      });
    return () => {
      active = false;
    };
  }, []);
}

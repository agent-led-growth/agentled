import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/**
 * The authenticated user for the current request, or null.
 *
 * Uses supabase.auth.getUser(), which validates the access token against the
 * Supabase Auth server rather than trusting the cookie contents — the correct
 * check for gating Server Components. Wrapped in React `cache` so repeated calls
 * within one render share a single validation round-trip.
 *
 * Caveat, specific to this repo: with no Proxy/middleware (see the README's
 * "Known constraints"), an expired access token cannot be refreshed from a
 * Server Component, which can read but not write cookies. When that happens
 * getUser() returns null and the caller should redirect home, where the
 * header's Sign in modal re-establishes the session. Refresh otherwise happens
 * client-side and inside Route Handlers.
 */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

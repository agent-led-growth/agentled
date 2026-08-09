/**
 * Thin wrapper around posthog-js so callers don't each repeat the "is analytics
 * even enabled?" guard. When NEXT_PUBLIC_POSTHOG_KEY is unset (local/dev without
 * a key) these are no-ops, mirroring the init guard in instrumentation-client.
 *
 * Client-only: posthog-js touches `window`. Import from Client Components.
 */
import posthog from "posthog-js";

import { env } from "@/lib/env";

const enabled = () => Boolean(env.posthogKey());

/** Link subsequent (and prior anonymous) events to a stable user id. */
export function identifyUser(id: string, email?: string) {
  if (!enabled()) return;
  posthog.identify(id, email ? { email } : undefined);
}

/** Unlink on sign-out so the next visitor on this device starts fresh. */
export function resetUser() {
  if (!enabled()) return;
  posthog.reset();
}

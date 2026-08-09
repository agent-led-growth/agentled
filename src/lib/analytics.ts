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

/**
 * The single source of truth for custom event names — keeps PostHog free of
 * typo'd duplicates and makes the taxonomy reviewable in one place. Tier 2
 * (onboarding / dashboard / post-signin) events get appended here once that
 * flow's architecture is finalized.
 */
export type AnalyticsEvent =
  | "scan_started" // domain submitted to scan (home hero + ai-search)
  | "signin_code_requested" // OTP email submitted, code sent
  | "signin_completed"; // OTP verified, session established

/** Capture a custom event. The union type rejects unregistered names. */
export function capture(event: AnalyticsEvent, props?: Record<string, unknown>) {
  if (!enabled()) return;
  posthog.capture(event, props);
}

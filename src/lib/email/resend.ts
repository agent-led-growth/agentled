import "server-only";

import { Resend } from "resend";

import { env } from "@/lib/env";

let client: Resend | null = null;

/**
 * The Resend client, or `null` when email is not configured (RESEND_API_KEY
 * unset). Callers must treat `null` as "email disabled" and skip the send —
 * every email in this app is a best-effort side effect, never load-bearing.
 */
export function resend(): Resend | null {
  const key = env.resendApiKey();
  if (!key) return null;
  if (!client) {
    client = new Resend(key);
  }
  return client;
}

/** Default sender. The domain must be verified in Resend before this works. */
export const FROM = "Agent-led Growth <hello@notifications.agentled.co>";

import "server-only";

import { resend } from "@/lib/email/resend";

/**
 * Internal, admin-only alerts to ourselves — never to the customer. Mirrors the
 * signup notification in `onboarding.ts` (same recipient/sender).
 */
export const NOTIFY_TO = "hugo@agentled.co";
export const NOTIFY_FROM = "Agent-led Growth <hello@notifications.agentled.co>";

/**
 * Fire-and-forget internal notification. Best-effort: a failure is logged, never
 * thrown — a throw here would 500 the Stripe webhook and make Stripe retry the
 * whole delivery (re-running the billing sync) just because an email hiccuped.
 */
export async function notifyInternal(subject: string, text: string): Promise<void> {
  try {
    const res = await resend().emails.send({
      from: NOTIFY_FROM,
      to: NOTIFY_TO,
      subject,
      text,
    });
    if (res.error) {
      console.error("notifyInternal: send failed", res.error);
    }
  } catch (err) {
    console.error("notifyInternal: send threw", err);
  }
}

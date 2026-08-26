import "server-only";

import { NOTIFY_FROM, NOTIFY_TO } from "@/lib/email/notify";
import { resend } from "@/lib/email/resend";

export type OnboardSource = "landing" | "ai-search";

/**
 * Per-source Resend wiring. Each source has its own manual segment (Audiences →
 * segment) and its own event, which triggers that source's automation. A user
 * only ever runs one automation — the first they hit — enforced by the caller's
 * single onboarding claim, not here.
 */
const CONFIG: Record<OnboardSource, { segmentId: string; event: string; via: string }> = {
  landing: {
    segmentId: "906a9cf3-5ec0-4fcf-a615-d28138b3e833",
    event: "user.signed_up_landing",
    via: "the Agent-led Growth landing page",
  },
  "ai-search": {
    segmentId: "bf7879bf-35cb-4250-934e-ce5c13d16913",
    event: "user.signed_up_ai_search",
    via: "the AI Search Monitor",
  },
};

/**
 * Onboard a brand-new verified signup through Resend for its source:
 *   1. add the contact to the source's segment (best effort),
 *   2. fire the source's event (triggers that automation),
 *   3. notify Hugo of the new signup (best effort).
 *
 * Returns `{ error }` reflecting only the event step — the one that must happen
 * exactly once. The caller rolls back its claim when that fails so the next
 * sign-in retries without risking a duplicate. Called only for new users.
 */
export async function onboard(
  email: string,
  source: OnboardSource,
): Promise<{ error: unknown | null }> {
  const cfg = CONFIG[source];
  const client = resend();

  const contact = await client.contacts.create({
    email,
    unsubscribed: false,
    segments: [{ id: cfg.segmentId }],
  });
  if (contact.error) {
    console.error("onboard: add-to-segment failed", contact.error);
  }

  const event = await client.events.send({ event: cfg.event, email });
  if (event.error) {
    return { error: event.error };
  }

  const notify = await client.emails.send({
    from: NOTIFY_FROM,
    to: NOTIFY_TO,
    subject: `New signup: ${email}`,
    text: `${email} just signed up via ${cfg.via}.`,
  });
  if (notify.error) {
    console.error("onboard: signup notification failed", notify.error);
  }

  return { error: null };
}

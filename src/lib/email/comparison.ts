import "server-only";

import { FROM, resend } from "@/lib/email/resend";

/**
 * Open Source Comparison lead flow, driven from the /open-source-comparison
 * landing. Unlike onboarding.ts (which fires a Resend *automation* event), this
 * adds the lead to a single Resend segment and sends a direct, code-owned email
 * linking to the public comparison table. Fired on every completed sign-in from
 * that landing (no once-per-user gating); both steps are best-effort so they
 * never block the sign-in.
 */

/** Resend segment the comparison leads are added to. */
const SEGMENT_ID = "be81a856-7d6b-4bd3-a560-36c14834aa9d";
/** The public, indexable comparison table the email links to. */
const TABLE_URL = "https://agentled.co/open-source-agent-readiness";

/**
 * Add the lead to the comparison segment. Best-effort: a failure is logged but
 * never thrown, so it can't block the email send or the sign-in.
 */
async function addToSegment(email: string): Promise<void> {
  try {
    const { error } = await resend().contacts.create({
      email,
      unsubscribed: false,
      segments: [{ id: SEGMENT_ID }],
    });
    if (error) console.error("comparison: add-to-segment failed", error);
  } catch (err) {
    console.error("comparison: add-to-segment threw", err);
  }
}

/**
 * Send the direct comparison email. Best-effort: a failure is logged, never
 * thrown, so it can't block the sign-in. Sent on every completed sign-in from
 * the landing, so a rare miss simply isn't retried.
 */
async function sendEmail(email: string): Promise<void> {
  try {
    const { error } = await resend().emails.send({
      from: FROM,
      to: email,
      subject: "See how leading open-source products build for agents",
      text:
        `Here's the comparison.\n\n` +
        `See how PostHog, Supabase, n8n, Postiz, and Resend approach the ` +
        `practices that make open-source products easier for agents to discover, ` +
        `understand, use, run, and contribute to:\n${TABLE_URL}`,
      html: emailHtml(),
    });
    if (error) console.error("comparison: email send failed", error);
  } catch (err) {
    console.error("comparison: email send threw", err);
  }
}

/**
 * Add the lead to the segment and email them the table link. Called on every
 * completed sign-in from the comparison landing (no once-per-user gating — a
 * repeat sign-in simply emails again). Both steps best-effort.
 */
export async function onboardComparison(email: string): Promise<void> {
  // Independent Resend calls — run them together so the sign-in response (which
  // awaits this) isn't delayed by two sequential round-trips. Both are
  // best-effort (they catch internally), so Promise.all never rejects.
  await Promise.all([addToSegment(email), sendEmail(email)]);
}

function emailHtml(): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#14170f;">
  <h1 style="font-size:20px;font-weight:700;margin:0 0 12px;">Open Source for Agents</h1>
  <p style="font-size:15px;line-height:1.55;color:#444;margin:0 0 24px;">
    See how <strong>PostHog, Supabase, n8n, Postiz, and Resend</strong> approach the practices that make open-source products easier for agents to discover, understand, use, run, and contribute to.
  </p>
  <a href="${TABLE_URL}" style="display:inline-block;background:#14170f;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:6px;">View the comparison &rarr;</a>
  <p style="font-size:12px;color:#999;margin:28px 0 0;">Agent-led Growth</p>
</div>`;
}

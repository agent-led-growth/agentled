import "server-only";

import { notifyInternal } from "@/lib/email/notify";
import type { Plan } from "@/lib/plan";

/**
 * Internal billing alerts to ourselves (see `notify.ts`). These are triggered
 * from the Stripe sync on real plan transitions, not on every webhook — so a
 * renewal or a redelivered event does not re-alert.
 */

/** A free/no-access account just started paying. */
export function notifyPaidConversion(email: string, plan: Plan): Promise<void> {
  return notifyInternal(
    `💰 New paid subscriber: ${email} (${plan})`,
    `${email} just started a paid ${plan} plan.`,
  );
}

/** A paying account dropped back to free (canceled / unpaid). */
export function notifyChurn(email: string, fromPlan: Plan): Promise<void> {
  return notifyInternal(
    `👋 Subscriber churned: ${email}`,
    `${email} cancelled their ${fromPlan} plan and is back on free.`,
  );
}

/** A payment failed; we mark the account past_due while Stripe retries. */
export function notifyPaymentFailed(email: string): Promise<void> {
  return notifyInternal(
    `⚠️ Payment failed: ${email}`,
    `A payment failed for ${email}; the account is now marked past_due while Stripe retries.`,
  );
}

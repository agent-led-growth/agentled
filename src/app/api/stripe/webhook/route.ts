import type Stripe from "stripe";

import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe/client";
import {
  linkStripeCustomer,
  markPaymentFailed,
  syncSubscription,
} from "@/lib/stripe/customer";

/**
 * Stripe webhook (Epic 6) — the only place billing state flows into the app, and
 * what replaces the manual `users.plan` setting used through Epics 1–5. Public
 * (no session): trust comes from the signature, verified against
 * STRIPE_WEBHOOK_SECRET.
 *
 * workerd note: verify with `constructEventAsync` (Web Crypto). The sync
 * `constructEvent` uses Node crypto and throws on Cloudflare. The raw body is read
 * with `request.text()` — the signature is over the exact bytes, so it must not be
 * re-serialized.
 *
 * Handlers are idempotent (Stripe may redeliver): every one re-derives state from
 * the Stripe object rather than applying a delta.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(
      payload,
      signature,
      env.stripeWebhookSecret(),
    );
  } catch (err) {
    // Bad signature or malformed payload — never our fault to retry, so 400.
    console.error("stripe webhook: signature verification failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    await handleEvent(event);
  } catch (err) {
    // A transient failure (e.g. DB blip): 500 so Stripe retries the delivery.
    console.error(`stripe webhook: handling ${event.type} failed`, err);
    return new Response("Handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id;

      // Fallback link only: our checkout route pre-creates and links the customer
      // before the session, so this is normally a no-op. It still matters for
      // subscriptions created outside that flow (e.g. straight from the Stripe
      // dashboard), where this is the first time we learn the customer. is-null
      // guarded, so it never clobbers an existing link.
      if (userId && customerId) {
        await linkStripeCustomer(userId, customerId);
      }

      // Mirror the subscription the checkout created. The session carries only the
      // subscription id, so fetch the full object for its price + status.
      const subId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      if (subId) {
        const sub = await stripe().subscriptions.retrieve(subId);
        await syncSubscription(sub);
      }
      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      // Stripe does not guarantee event ordering, so a late-delivered older event
      // could carry stale state. Re-fetch the subscription by id and mirror the
      // *current* truth rather than trusting this event's snapshot. (A deleted
      // subscription is still retrievable, with status 'canceled'.)
      const stale = event.data.object as Stripe.Subscription;
      const fresh = await stripe().subscriptions.retrieve(stale.id);
      await syncSubscription(fresh);
      return;
    }

    case "invoice.payment_failed": {
      // Use attempt_count from the event snapshot, NOT a re-fetch. The snapshot's
      // count is the value at *this* failure — exactly what "is this the first
      // failure?" needs. A re-fetch returns the *current* count, so a delayed or
      // backlogged first-failure event (whose retry has since bumped the count)
      // would look like a retry and drop the alert entirely. Don't reintroduce a
      // retrieve() here.
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (customerId) {
        // attempt_count is 1 on the first failed charge and increments on each
        // retry — alert only on the first so Stripe's retry schedule (attempts
        // days apart) doesn't re-notify us. A reordered/redelivered retry event may
        // still cause an occasional duplicate; that's just a harmless internal email.
        await markPaymentFailed(customerId, {
          firstFailure: (invoice.attempt_count ?? 0) <= 1,
        });
      }
      return;
    }

    default:
      // Unhandled event types are acknowledged (200) so Stripe stops retrying.
      return;
  }
}

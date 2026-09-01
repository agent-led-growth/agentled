import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import {
  getBillingProfile,
  hasActiveSubscription,
  hasLiveSubscription,
  linkStripeCustomer,
} from "@/lib/stripe/customer";
import { priceIdFor } from "@/lib/stripe/prices";
import { isPaidPlan, type Interval } from "@/lib/pricing";
import { planOf } from "@/lib/plan";

/**
 * Start a Stripe Checkout Session for a paid plan (Epic 6). Requires a signed-in
 * user — the pricing page signs a visitor in first, then calls this.
 *
 * Two guards keep billing honest:
 * - An account that already has a live subscription gets `{ manage: true }` (not a
 *   Checkout URL), so the client shows the "manage in the portal" modal instead of
 *   opening a second subscription-mode Checkout that would leave them paying twice.
 *   The check confirms against Stripe when the mirror is behind the webhook.
 * - The Stripe customer is created and persisted before checkout (one customer
 *   per account), so a concurrent retry can't spawn a second customer whose
 *   subscription the webhook would fail to link.
 *
 * Returns `{ url }` (a Checkout Session to redirect to) or `{ manage: true }`.
 */
export async function POST(request: Request) {
  if (!env.stripeEnabled()) {
    return NextResponse.json({ error: "Billing is not enabled." }, { status: 503 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const plan = planOf(typeof body.plan === "string" ? body.plan : undefined);
  const interval: Interval = body.interval === "yearly" ? "yearly" : "monthly";
  if (!isPaidPlan(plan)) {
    return NextResponse.json({ error: "Choose a paid plan." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  let profile;
  try {
    profile = await getBillingProfile(user.id);
  } catch (err) {
    console.error("stripe checkout: profile lookup failed", err);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Account not found." }, { status: 400 });
  }

  // Base every redirect on our own site URL, not the request's Host header, so a
  // proxied or spoofed Host can't send the post-checkout redirect elsewhere.
  const base = env.siteUrl();

  try {
    // Already subscribed → tell the client to route to the portal to switch/manage,
    // never open a second subscription-mode Checkout (that would double-bill). The
    // mirror lags the webhook, so if the cheap check is negative but a customer
    // exists, confirm against Stripe directly to close the just-checked-out window.
    const subscribed =
      hasActiveSubscription(profile) ||
      (profile.stripeCustomerId
        ? await hasLiveSubscription(profile.stripeCustomerId)
        : false);
    if (subscribed) {
      return NextResponse.json({ manage: true });
    }

    // Ensure exactly one persisted Stripe customer before checkout. Create + link
    // eagerly, then re-read so that if a concurrent request won the link race we
    // use the customer it persisted (the loser's customer is left unused, no sub).
    let customerId = profile.stripeCustomerId;
    if (!customerId) {
      const created = await stripe().customers.create({
        email: profile.email,
        metadata: { userId: profile.userId },
      });
      await linkStripeCustomer(profile.userId, created.id);
      const fresh = await getBillingProfile(user.id);
      customerId = fresh?.stripeCustomerId ?? created.id;
    }

    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceIdFor(plan, interval), quantity: 1 }],
      client_reference_id: profile.userId,
      customer: customerId,
      metadata: { userId: profile.userId, plan, interval },
      success_url: `${base}/ai-search/dashboard?tab=account&checkout=success`,
      cancel_url: `${base}/ai-search/pricing?checkout=cancel`,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("stripe checkout: session create failed", err);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }
}

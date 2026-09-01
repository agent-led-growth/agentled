import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { getBillingProfile } from "@/lib/stripe/customer";

/**
 * Open the Stripe-hosted Customer Portal (Epic 6) — the standard "manage billing"
 * center where a customer updates their card, switches plan, or cancels. Requires
 * a signed-in user who already has a Stripe customer (i.e. has checked out at least
 * once); free users have no customer and get a 400 so the UI shows Upgrade instead.
 * Returns the portal URL for the client to redirect to.
 */
export async function POST() {
  if (!env.stripeEnabled()) {
    return NextResponse.json({ error: "Billing is not enabled." }, { status: 503 });
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
    console.error("stripe portal: profile lookup failed", err);
    return NextResponse.json({ error: "Could not open billing." }, { status: 500 });
  }
  if (!profile?.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account yet." }, { status: 400 });
  }

  // Scope to the agentled portal configuration when set, so on a shared Stripe
  // account customers only see agentled plans (not other businesses' products).
  const configuration = env.stripePortalConfigurationId();
  try {
    const session = await stripe().billingPortal.sessions.create({
      customer: profile.stripeCustomerId,
      return_url: `${env.siteUrl()}/ai-search/dashboard?tab=account`,
      ...(configuration ? { configuration } : {}),
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    // A bad STRIPE_PORTAL_CONFIGURATION_ID (typo, deleted, foreign account) fails
    // here with `param: "configuration"`. Call it out distinctly so the misconfig
    // is diagnosable instead of hiding behind the generic message.
    const param = (err as { param?: string })?.param;
    if (configuration && param === "configuration") {
      console.error(
        `stripe portal: invalid STRIPE_PORTAL_CONFIGURATION_ID (${configuration}) — check the bpc_ id`,
        err,
      );
    } else {
      console.error("stripe portal: session create failed", err);
    }
    return NextResponse.json({ error: "Could not open billing." }, { status: 500 });
  }
}

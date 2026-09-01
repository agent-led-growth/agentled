import Stripe from "stripe";

import { env } from "@/lib/env";

/**
 * A Stripe client that runs on Cloudflare Workers (workerd), not just Node.
 *
 * workerd has no Node `http`/`https`, so the SDK's default Node HTTP client
 * throws there. `createFetchHttpClient()` routes every call through the global
 * `fetch`, which workerd provides. For the same reason webhook verification must
 * use `stripe.webhooks.constructEventAsync` (Web Crypto), never the sync
 * `constructEvent` (Node crypto) — see the webhook route.
 *
 * Built lazily per call so the module can be imported anywhere without requiring
 * STRIPE_SECRET_KEY at import time (env is only read when billing is actually
 * exercised). Cheap to construct; no connection is held open.
 */
export function stripe(): Stripe {
  const key = env.stripeSecretKey();
  if (!key) {
    // Billing is optional. Routes guard with `env.stripeEnabled()` and return 503
    // before reaching here; this throw is the backstop for any other caller.
    throw new Error(
      "Stripe is not configured: set STRIPE_SECRET_KEY (or SELF_HOSTED=true to run without billing).",
    );
  }
  return new Stripe(key, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

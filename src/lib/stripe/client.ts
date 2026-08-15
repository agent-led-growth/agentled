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
  return new Stripe(env.stripeSecretKey(), {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

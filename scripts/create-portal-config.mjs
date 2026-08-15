/**
 * One-time: create a Stripe Customer Portal *configuration* scoped to the agentled
 * plans only. On a shared Stripe account (other businesses' products live in the
 * default portal config), this keeps agentled customers seeing agentled plans and
 * nothing else. Prints the configuration id (bpc_…) to set as
 * STRIPE_PORTAL_CONFIGURATION_ID on the worker.
 *
 * Run with the LIVE secret key (from your terminal, not committed):
 *   export STRIPE_SECRET_KEY=sk_live_...
 *   node scripts/create-portal-config.mjs
 *   unset STRIPE_SECRET_KEY
 *
 * Re-runnable: creating another configuration is harmless; just use the newest id.
 * To edit later, change this file and re-run, or update the config in the dashboard.
 */
import Stripe from "stripe";

// The six live price ids (mirror of wrangler.jsonc → vars). Grouped into their
// products below, which is what the portal's "switch plan" list needs.
const PRICE_IDS = [
  "price_1U4iAiLrSZ1ZGVqmWH5OYRJj", // starter monthly
  "price_1U4iCDLrSZ1ZGVqmK9PTJ4ae", // starter yearly
  "price_1U4iFdLrSZ1ZGVqm93L3KZkZ", // pro monthly
  "price_1U4iFdLrSZ1ZGVqmeaTjjQJw", // pro yearly
  "price_1U4iH7LrSZ1ZGVqmG5Somx9q", // business monthly
  "price_1U4iHuLrSZ1ZGVqm5zx7iASg", // business yearly
];

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Set STRIPE_SECRET_KEY (the LIVE key) in the environment first.");
  process.exit(1);
}
if (!key.startsWith("sk_live_")) {
  console.warn(`Warning: key does not start with sk_live_ (got ${key.slice(0, 8)}…). Continuing.`);
}

const stripe = new Stripe(key);

// Resolve each price to its product, then group prices by product so the portal
// lets customers switch among the intervals of each agentled plan.
const byProduct = new Map();
for (const id of PRICE_IDS) {
  const price = await stripe.prices.retrieve(id);
  const productId = typeof price.product === "string" ? price.product : price.product.id;
  if (!byProduct.has(productId)) byProduct.set(productId, []);
  byProduct.get(productId).push(id);
}

const products = [...byProduct.entries()].map(([product, prices]) => ({ product, prices }));
console.log("Products in this portal configuration:");
for (const p of products) console.log(`  ${p.product}: ${p.prices.join(", ")}`);

const config = await stripe.billingPortal.configurations.create({
  features: {
    customer_update: { enabled: true, allowed_updates: ["email", "address", "tax_id"] },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: { enabled: true, mode: "at_period_end" },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ["price"],
      proration_behavior: "create_prorations",
      products,
    },
  },
});

console.log(`\n✅ Created portal configuration: ${config.id}`);
console.log(`\nSet it on the worker:\n  pnpm wrangler secret put STRIPE_PORTAL_CONFIGURATION_ID\n  (paste: ${config.id})`);

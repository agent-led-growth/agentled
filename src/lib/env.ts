/**
 * Central place to read environment variables so a missing value fails loudly
 * at the call site instead of surfacing as a confusing runtime error later.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  // --- Required ---
  // The minimal set a self-hosted instance needs to boot: Supabase + OpenAI.
  supabaseUrl: () =>
    required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () =>
    required(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
  supabaseServiceRoleKey: () =>
    required(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
  openaiApiKey: () => required("OPENAI_API_KEY", process.env.OPENAI_API_KEY),

  // --- Optional (the related feature disables itself when unset) ---
  // Transactional email. Unset ⇒ email is skipped (onboarding, notifications,
  // scan-ready) rather than throwing. Gate on `emailEnabled()`.
  resendApiKey: (): string | undefined => process.env.RESEND_API_KEY,
  // Shared secret guarding the internal scan-execute/-fail routes, which the
  // scan-consumer worker calls server-to-server (no user session). Unset ⇒ the
  // internal routes reject every request (locked down), so only set it if you
  // run the background scan workers.
  internalSecret: (): string | undefined => process.env.INTERNAL_SECRET,
  // Stripe billing (Epic 6). Secret key for the API, webhook secret for verifying
  // the signature on /api/stripe/webhook. Unset ⇒ billing is disabled: the Stripe
  // routes return 503 and `stripe()` throws with a clear message. Gate on
  // `stripeEnabled()`. Self-hosters can run the whole app without either.
  stripeSecretKey: (): string | undefined => process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: (): string | undefined => process.env.STRIPE_WEBHOOK_SECRET,

  // --- Feature predicates ---
  // Truthy only when the service's keys are present, so call sites can branch
  // without re-implementing the "which vars count" rule.
  emailEnabled: (): boolean => Boolean(process.env.RESEND_API_KEY),
  stripeEnabled: (): boolean =>
    Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
  // Self-hosting switch: skips billing and removes plan-based gating on scan
  // cadence. Leave unset/false for the hosted commercial configuration.
  selfHosted: (): boolean => process.env.SELF_HOSTED === "true",
  // Optional: a dedicated Customer Portal configuration scoped to the agentled
  // plans. Set in production (a shared Stripe account has other businesses' products
  // in the default portal config); when absent the portal falls back to the account
  // default, which is fine for local test mode.
  stripePortalConfigurationId: (): string | undefined =>
    process.env.STRIPE_PORTAL_CONFIGURATION_ID,
  // The six Stripe price ids (starter/pro/business × monthly/yearly). Env-driven so
  // swapping the local $0.10 test prices for the real live prices is a config change,
  // never a code change. Read through the price map in src/lib/stripe/prices.ts.
  stripePriceId: (key: string): string | undefined =>
    process.env[`STRIPE_PRICE_${key}`],
  // Optional: authenticates the Jina Reader. Keyless works from residential IPs
  // (local dev) but is refused from Cloudflare's egress; set it in production.
  jinaApiKey: (): string | undefined => process.env.JINA_API_KEY,
  siteUrl: () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://agentled.co",
  // Optional: analytics init is skipped when the key is absent, so a missing
  // value degrades to "no tracking" rather than taking down the client bundle.
  posthogKey: (): string | undefined => process.env.NEXT_PUBLIC_POSTHOG_KEY,
  posthogHost: () =>
    process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
};

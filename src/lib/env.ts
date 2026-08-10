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
  resendApiKey: () => required("RESEND_API_KEY", process.env.RESEND_API_KEY),
  openaiApiKey: () => required("OPENAI_API_KEY", process.env.OPENAI_API_KEY),
  // Shared secret guarding the internal scan-execute/-fail routes, which the
  // scan-consumer worker calls server-to-server (no user session).
  internalSecret: () => required("INTERNAL_SECRET", process.env.INTERNAL_SECRET),
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

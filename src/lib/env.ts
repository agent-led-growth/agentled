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
  siteUrl: () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://agentled.co",
};

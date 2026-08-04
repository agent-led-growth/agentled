import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Whether the auth user has run an AI-search scan — i.e. has an ai_search_sites
 * row. Uses the admin client because that table has no client read policy.
 */
export async function hasScanned(authUserId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (!profile) return false;

  const { data: site } = await admin
    .from("ai_search_sites")
    .select("id")
    .eq("user_id", profile.id)
    .maybeSingle();
  return Boolean(site);
}

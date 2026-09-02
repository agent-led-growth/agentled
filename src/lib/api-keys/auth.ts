import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { hashApiKey } from "./keys";

/**
 * Public-API authentication: resolve an `Authorization: Bearer agl_live_…` header
 * to the account that owns the key. Returns null for a missing / malformed /
 * unknown / revoked key — the route turns that into a 401. Uses the service-role
 * client; the caller is then responsible for scoping every query to `userId`.
 */

export type ApiKeyContext = { userId: string; keyId: string };

/** Don't write last_used_at more than once per key per this window (avoid a write per request). */
const STAMP_THROTTLE_MS = 60_000;

export async function requireApiKey(request: Request): Promise<ApiKeyContext | null> {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match) return null;
  const presented = match[1];
  // Cheap shape check before hashing/DB — a token without our prefix can't match.
  if (!presented.startsWith("agl_live_")) return null;

  const keyHash = await hashApiKey(presented);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("api_keys")
    .select("id, user_id, last_used_at")
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as { id: string; user_id: string; last_used_at: string | null };
  const last = row.last_used_at ? Date.parse(row.last_used_at) : 0;
  if (Date.now() - last > STAMP_THROTTLE_MS) {
    // Best-effort: a failed stamp must not fail the request.
    await admin
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", row.id)
      .then(undefined, (err) => console.error("api-key: last_used_at stamp failed", err));
  }
  return { userId: row.user_id, keyId: row.id };
}

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Account API keys for the public API. The plaintext secret is returned to the
 * user exactly once (at creation) and never stored — we keep only its SHA-256
 * hash (what an incoming request is matched against) and a short display prefix.
 *
 * SHA-256 (not bcrypt) is correct here: the secret is 256 bits of CSPRNG output,
 * so it isn't guessable/brute-forceable the way a low-entropy password is, and a
 * fast hash lets us look a request up by `key_hash` directly.
 *
 * All access is via the service-role admin client, scoped to a user_id in code —
 * the table has RLS enabled with no policies, so it is unreachable from the browser.
 */

const KEY_PREFIX = "agl_live_";
/** How many leading characters of the key we keep for display (e.g. in the UI). */
const DISPLAY_PREFIX_LEN = KEY_PREFIX.length + 6;

export type ApiKeySummary = {
  id: string;
  label: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
};

/** URL-safe token from `bytes` of CSPRNG output (workerd Web Crypto). */
function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Lowercase-hex SHA-256 of `input` via Web Crypto (available on workerd). */
export async function hashApiKey(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Mint a new key for a user. Returns the one-time plaintext (show it once, never
 * again) alongside the stored summary. The caller is responsible for having
 * authenticated the user and resolved their `public.users` id.
 */
export async function createApiKey(
  userId: string,
  label: string,
): Promise<{ id: string; plaintext: string; summary: ApiKeySummary }> {
  const plaintext = `${KEY_PREFIX}${randomToken(32)}`;
  const keyHash = await hashApiKey(plaintext);
  const keyPrefix = plaintext.slice(0, DISPLAY_PREFIX_LEN);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("api_keys")
    .insert({ user_id: userId, label, key_hash: keyHash, key_prefix: keyPrefix })
    .select("id, label, key_prefix, last_used_at, created_at")
    .single();
  if (error) throw error;

  const row = data as {
    id: string;
    label: string;
    key_prefix: string;
    last_used_at: string | null;
    created_at: string;
  };
  return {
    id: row.id,
    plaintext,
    summary: {
      id: row.id,
      label: row.label,
      keyPrefix: row.key_prefix,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at,
    },
  };
}

/** A user's active (non-revoked) keys, newest first. Never returns the secret. */
export async function listApiKeys(userId: string): Promise<ApiKeySummary[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("api_keys")
    .select("id, label, key_prefix, last_used_at, created_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((r) => {
    const row = r as {
      id: string;
      label: string;
      key_prefix: string;
      last_used_at: string | null;
      created_at: string;
    };
    return {
      id: row.id,
      label: row.label,
      keyPrefix: row.key_prefix,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at,
    };
  });
}

/**
 * Revoke a key. Scoped to `userId` so one account can never revoke another's key
 * even with a guessed id. Returns whether a row was actually revoked.
 */
export async function revokeApiKey(userId: string, keyId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

import { NextResponse } from "next/server";

import { getUserIdByAuthId } from "@/lib/ai-search";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/api-keys/keys";
import { createClient } from "@/lib/supabase/server";

/**
 * API-key management for the signed-in account (used by the Account tab). These
 * are session-cookie authed — creating/listing/revoking a key is a first-party
 * UI action, distinct from the public API itself (which the keys authenticate).
 *
 * - GET    → list the account's active keys (never the secret)
 * - POST   { label } → mint a key; the plaintext is returned ONCE here and never again
 * - DELETE ?id=<uuid> → revoke a key
 */

const MAX_LABEL_LEN = 60;
/** A sane cap so a single account can't mint keys without bound. */
const MAX_ACTIVE_KEYS = 10;

/** Resolve the app-owned user id for the current session, or null if signed out. */
async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return getUserIdByAuthId(user.id);
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  const keys = await listApiKeys(userId);
  return NextResponse.json({ keys });
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const raw = typeof body.label === "string" ? body.label.trim() : "";
  const label = (raw || "API key").slice(0, MAX_LABEL_LEN);

  // Cap active keys so create can't run away. Revoked keys don't count.
  const existing = await listApiKeys(userId);
  if (existing.length >= MAX_ACTIVE_KEYS) {
    return NextResponse.json(
      { error: `You can have at most ${MAX_ACTIVE_KEYS} active keys. Revoke one first.` },
      { status: 409 },
    );
  }

  const { plaintext, summary } = await createApiKey(userId, label);
  // `key` is the one and only time the secret is returned — the client must show
  // it to the user immediately and never expect to fetch it again.
  return NextResponse.json({ key: plaintext, ...summary }, { status: 201 });
}

export async function DELETE(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing key id." }, { status: 400 });

  const revoked = await revokeApiKey(userId, id);
  if (!revoked) return NextResponse.json({ error: "Key not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

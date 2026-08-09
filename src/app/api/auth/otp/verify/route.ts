import { NextResponse } from "next/server";

import { onboard, type OnboardSource } from "@/lib/email/onboarding";
import { claimBrandForMember } from "@/lib/laurel";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Supabase email OTP codes are 6 digits by default.
const CODE_RE = /^\d{6}$/;

type Site = { brandId?: string; topics: string[] };

/**
 * Step 2 of email-OTP sign-in: verify the code and establish the session.
 *
 * On success verifyOtp writes the session cookies onto this response, so the
 * browser is signed in. We then make sure a public.users row exists and run
 * onboarding for the request's `source` (landing | ai-search). A user only ever
 * runs one automation — the first they hit — because both are gated by the same
 * single claim (welcome_email_sent_at). For the ai-search source we also attach
 * the user to the pre-scan brand and persist their topic selection.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { email, token } = body;
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }
  if (typeof token !== "string" || !CODE_RE.test(token.trim())) {
    return NextResponse.json(
      { error: "Enter the 6-digit code from your email." },
      { status: 400 },
    );
  }

  const source: OnboardSource = body.source === "ai-search" ? "ai-search" : "landing";
  const site = sanitizeSite(body);
  const normalized = email.trim().toLowerCase();

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email: normalized,
      token: token.trim(),
      type: "email",
    });

    if (error || !data.user) {
      // Wrong or expired code is the common case — a 401, not a server fault.
      return NextResponse.json(
        { error: "That code is invalid or has expired. Request a new one." },
        { status: 401 },
      );
    }

    // Link the auth user to their row + run onboarding with the service-role
    // client. Failures here must not fail the sign-in — the session is already
    // valid — so they are logged and swallowed.
    try {
      await linkUserAndOnboard(data.user.id, normalized, source, site);
    } catch (err) {
      console.error("otp verify: profile/onboarding step failed", err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("otp verify: unexpected failure", err);
    return NextResponse.json(
      { error: "Could not verify that code right now. Please try again." },
      { status: 500 },
    );
  }
}

function sanitizeSite(body: Record<string, unknown>): Site {
  const brandId =
    typeof body.brandId === "string" && body.brandId.trim()
      ? body.brandId.trim()
      : undefined;
  const topics = Array.isArray(body.topics)
    ? body.topics
        .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        .map((t) => t.trim().slice(0, 200))
        .slice(0, 50)
    : [];
  return { brandId, topics };
}

/**
 * Link the auth user to their row, attach the ai-search brand if present, then
 * atomically claim onboarding so a user runs exactly one automation ever
 * (whichever source comes first).
 */
async function linkUserAndOnboard(
  authUserId: string,
  email: string,
  source: OnboardSource,
  site: Site,
) {
  const admin = createAdminClient();

  // Upsert by normalised email: a subscribe-first row is linked + confirmed in
  // place, a brand-new sign-in creates the row. welcome_email_sent_at is left
  // untouched so an already-onboarded person is not onboarded again.
  const { data: row, error: upsertError } = await admin
    .from("users")
    .upsert(
      {
        email,
        auth_user_id: authUserId,
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      },
      { onConflict: "email_normalized" },
    )
    .select("id")
    .single();
  if (upsertError) throw upsertError;

  // Claim the Laurel brand they onboarded: attach the member (flipping it active
  // + owned) and persist their topic selection, reusing an existing brand for
  // this domain instead of duplicating the connection. Best effort: a failure
  // here must not block the sign-in or, via a claim rollback, re-fire the
  // automation. `row.id` is this user's public.users id.
  if (source === "ai-search" && site.brandId) {
    try {
      await claimBrandForMember(site.brandId, row.id, site.topics);
    } catch (err) {
      console.error("otp verify: brand claim failed", err);
    }
  }

  // Claim onboarding: only the request that flips null -> now() gets a row back
  // and is therefore responsible for running it. Shared across sources, so a
  // user joins only their first automation.
  const { data: claimed, error: claimError } = await admin
    .from("users")
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("welcome_email_sent_at", null)
    .select("id")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return; // Already onboarded via some source — nothing to do.

  const { error: onboardError } = await onboard(email, source);
  if (onboardError) {
    // Roll the claim back so a later sign-in retries rather than leaving the
    // signup un-onboarded (no automation fired).
    await admin
      .from("users")
      .update({ welcome_email_sent_at: null })
      .eq("id", row.id);
    throw onboardError;
  }
}

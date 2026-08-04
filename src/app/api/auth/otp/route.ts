import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

// Mirrors the client-side check; this is the one that actually counts.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Step 1 of email-OTP sign-in: send a 6-digit code to the address.
 *
 * Supabase Auth owns the code — generation, hashing, expiry, replay protection
 * and per-address rate limiting all happen server-side. `shouldCreateUser`
 * means a first-time address is created here (email unconfirmed) and confirmed
 * when the code is verified. We always answer 200 on the happy path so the
 * endpoint never reveals whether an address already has an account.
 */
export async function POST(request: Request) {
  let email: unknown;
  try {
    ({ email } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  const normalized = email.trim().toLowerCase();
  if (normalized.length > 254) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: { shouldCreateUser: true },
    });

    if (error) {
      // Rate limiting is the expected non-fatal failure — surface it as such so
      // the user knows to wait rather than seeing a generic error.
      if (error.status === 429) {
        return NextResponse.json(
          { error: "Too many requests. Wait a minute and try again." },
          { status: 429 },
        );
      }
      console.error("otp: signInWithOtp failed", error);
      return NextResponse.json(
        { error: "Could not send a code right now. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("otp: unexpected failure", err);
    return NextResponse.json(
      { error: "Could not send a code right now. Please try again." },
      { status: 500 },
    );
  }
}

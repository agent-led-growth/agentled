import { NextResponse } from "next/server";

import { FROM, resend } from "@/lib/email/resend";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

// Mirrors the client-side check; this is the one that actually counts.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    const supabase = createAdminClient();

    // Upsert so a repeat subscribe is idempotent rather than a duplicate-key
    // error the user would see as a failure.
    const { data, error } = await supabase
      .from("subscribers")
      .upsert(
        { email: normalized, source: "landing-hero" },
        { onConflict: "email_normalized", ignoreDuplicates: false },
      )
      .select("token, status")
      .single();

    if (error) {
      console.error("subscribe: supabase insert failed", error);
      return NextResponse.json(
        { error: "Could not subscribe right now. Please try again." },
        { status: 500 },
      );
    }

    // Already confirmed — nothing more to send.
    if (data.status === "confirmed") {
      return NextResponse.json({ ok: true, alreadySubscribed: true });
    }

    const confirmUrl = `${env.siteUrl()}/api/subscribe/confirm?token=${data.token}`;

    const { error: emailError } = await resend().emails.send({
      from: FROM,
      to: normalized,
      subject: "Confirm your subscription to Agent-led Growth",
      text: [
        "Thanks for subscribing to Agent-led Growth.",
        "",
        "Confirm your email to start receiving research, experiments, and tools",
        "for the next generation of growth:",
        "",
        confirmUrl,
        "",
        "If you did not request this, you can ignore this email.",
      ].join("\n"),
    });

    if (emailError) {
      // The row is saved; only the confirmation email failed. Log it, but do
      // not fail the request — the address is captured either way.
      console.error("subscribe: resend send failed", emailError);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("subscribe: unexpected failure", err);
    return NextResponse.json(
      { error: "Could not subscribe right now. Please try again." },
      { status: 500 },
    );
  }
}

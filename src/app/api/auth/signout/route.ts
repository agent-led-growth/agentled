import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Sign out. signOut() clears the session cookies through the server client's
 * cookie adapter, so they are removed on this response. Posted to from the
 * account page; we 303 back home so the browser follows with a GET.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.error("signout: failed", err);
  }
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}

import { NextResponse } from "next/server";

import { hasActiveBrand } from "@/lib/ai-search";
import { createClient } from "@/lib/supabase/server";

/**
 * Whether the current user has an active (claimed) brand — i.e. has completed
 * onboarding. Used to bounce returning, already-set-up users from the
 * /ai-search landing to their home. The response key stays `hasScanned` so the
 * existing redirect components need no change.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return NextResponse.json({
    hasScanned: user ? await hasActiveBrand(user.id) : false,
  });
}

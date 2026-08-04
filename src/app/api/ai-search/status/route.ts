import { NextResponse } from "next/server";

import { hasScanned } from "@/lib/ai-search";
import { createClient } from "@/lib/supabase/server";

/**
 * Whether the current user has already run an AI-search scan. Used to bounce
 * returning, already-set-up users from the /ai-search landing to their home.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return NextResponse.json({
    hasScanned: user ? await hasScanned(user.id) : false,
  });
}

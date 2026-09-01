import { NextResponse } from "next/server";

import { getPlanForAuthUser } from "@/lib/ai-search";
import { createClient } from "@/lib/supabase/server";

/**
 * The current account's plan — lightweight, so the public pricing page can mark
 * the user's current plan without pulling their brands. `free` for signed-out
 * visitors (and fail-closed to `free` inside getPlanForAuthUser on any error).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ plan: "free" });

  const plan = await getPlanForAuthUser(user.id);
  return NextResponse.json({ plan });
}

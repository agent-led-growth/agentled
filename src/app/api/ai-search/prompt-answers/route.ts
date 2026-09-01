import { NextResponse } from "next/server";

import { getBrandsForUser, getPromptAnswers, getPromptById } from "@/lib/ai-search";
import { createClient } from "@/lib/supabase/server";

/**
 * GET ?prompt=<id> → the prompt's answer history, newest run first (the detail
 * view's run navigator). Account-scoped: the prompt must belong to a brand the
 * signed-in user is a member of, or it's a 404 — no cross-account reads.
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const promptId = new URL(req.url).searchParams.get("prompt");
  if (!promptId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const prompt = await getPromptById(promptId);
  if (!prompt) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const brands = await getBrandsForUser(user.id);
  if (!brands.some((b) => b.id === prompt.brand_id))
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  const answers = await getPromptAnswers(prompt.brand_id, promptId);
  return NextResponse.json({ answers });
}

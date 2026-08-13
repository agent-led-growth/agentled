import { NextResponse } from "next/server";

import {
  countActivePrompts,
  createPrompt,
  getBrandsForUser,
  getPlanForAuthUser,
  getPromptById,
  listPrompts,
  setPromptActive,
  updatePromptText,
} from "@/lib/laurel";
import { promptLimit } from "@/lib/plan";
import { createClient } from "@/lib/supabase/server";

/** Longest a monitored question may be. */
const MAX_LEN = 300;

/**
 * The signed-in user's account context: their brand ids (the account is the set
 * of brands they're a member of) and plan. Every write is scoped to these brand
 * ids, so a user can only touch prompts on brands they own. Null when signed out.
 */
async function account() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [brands, plan] = await Promise.all([
    getBrandsForUser(user.id),
    getPlanForAuthUser(user.id),
  ]);
  return { brandIds: brands.map((b) => b.id), plan };
}

/** GET ?brand=<id> → the brand's active prompts + account-wide usage. */
export async function GET(req: Request) {
  const acc = await account();
  if (!acc) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const brandId = new URL(req.url).searchParams.get("brand");
  if (!brandId || !acc.brandIds.includes(brandId))
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [prompts, used] = await Promise.all([
    listPrompts(brandId),
    countActivePrompts(acc.brandIds),
  ]);
  return NextResponse.json({
    prompts: prompts.filter((p) => p.active).map((p) => ({ id: p.id, text: p.text })),
    usage: { used, limit: promptLimit(acc.plan) },
  });
}

/** POST { brandId, text } → add a prompt. Enforces the account prompt limit. */
export async function POST(req: Request) {
  const acc = await account();
  if (!acc) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { brandId?: string; text?: string };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!body.brandId || !acc.brandIds.includes(body.brandId))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!text) return NextResponse.json({ error: "empty" }, { status: 400 });
  if (text.length > MAX_LEN) return NextResponse.json({ error: "too_long" }, { status: 400 });

  const limit = promptLimit(acc.plan);
  const used = await countActivePrompts(acc.brandIds);
  if (used >= limit)
    return NextResponse.json({ error: "limit_reached", usage: { used, limit } }, { status: 409 });

  const p = await createPrompt(body.brandId, text);

  // The pre-check and insert aren't atomic, so a concurrent add could push the
  // account over the cap. Re-count and soft-roll-back this one if so, so the
  // limit is never actually exceeded.
  const after = await countActivePrompts(acc.brandIds);
  if (after > limit) {
    await setPromptActive(p.id, false);
    return NextResponse.json({ error: "limit_reached", usage: { used: limit, limit } }, { status: 409 });
  }
  return NextResponse.json({ prompt: { id: p.id, text: p.text }, usage: { used: after, limit } });
}

/** PATCH { id, text } → edit a prompt's question text (account-scoped). */
export async function PATCH(req: Request) {
  const acc = await account();
  if (!acc) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { id?: string; text?: string };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!body.id || !text) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (text.length > MAX_LEN) return NextResponse.json({ error: "too_long" }, { status: 400 });

  const prompt = await getPromptById(body.id);
  if (!prompt || !acc.brandIds.includes(prompt.brand_id))
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  await updatePromptText(body.id, text);
  return NextResponse.json({ ok: true });
}

/** DELETE { id } → deactivate a prompt (soft; scan history kept). */
export async function DELETE(req: Request) {
  const acc = await account();
  if (!acc) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const prompt = await getPromptById(body.id);
  if (!prompt || !acc.brandIds.includes(prompt.brand_id))
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  await setPromptActive(body.id, false);
  const used = await countActivePrompts(acc.brandIds);
  return NextResponse.json({ ok: true, usage: { used, limit: promptLimit(acc.plan) } });
}

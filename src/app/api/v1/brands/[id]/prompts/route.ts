import { NextResponse } from "next/server";

import { isBrandMember, listPrompts } from "@/lib/ai-search";
import { requireApiKey } from "@/lib/api-keys/auth";
import { notFound, serverError, unauthorized } from "@/lib/api/respond";
import { serializePrompt } from "@/lib/api/serialize";

/** GET /api/v1/brands/{id}/prompts → the brand's prompts (questions). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireApiKey(request);
    if (!ctx) return unauthorized();

    const { id } = await params;
    if (!(await isBrandMember(ctx.userId, id))) return notFound("Brand");

    const prompts = await listPrompts(id);
    return NextResponse.json({ prompts: prompts.map(serializePrompt) });
  } catch (err) {
    console.error("GET /api/v1/brands/[id]/prompts", err);
    return serverError();
  }
}

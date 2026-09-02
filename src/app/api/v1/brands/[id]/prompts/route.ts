import { NextResponse } from "next/server";

import { assertBrandMember, listPrompts } from "@/lib/ai-search";
import { notFound } from "@/lib/api/respond";
import { isUuid, withApiKey } from "@/lib/api/route";
import { serializePrompt } from "@/lib/api/serialize";

/**
 * GET /api/v1/brands/{id}/prompts → the brand's prompts (questions), active and
 * inactive. A "removed" prompt is a soft delete (active=false), kept for history,
 * so both are returned. Optional `?active=true|false` filters; omit for all.
 */
export const GET = withApiKey(
  async (auth, { params }: { params: Promise<{ id: string }> }, request) => {
    const { id } = await params;
    if (!isUuid(id)) return notFound("Brand");
    if (!(await assertBrandMember(auth.userId, id))) return notFound("Brand");

    const activeParam = new URL(request.url).searchParams.get("active");
    let prompts = await listPrompts(id);
    if (activeParam === "true") prompts = prompts.filter((p) => p.active);
    else if (activeParam === "false") prompts = prompts.filter((p) => !p.active);

    return NextResponse.json({ prompts: prompts.map(serializePrompt) });
  },
);

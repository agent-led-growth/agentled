import { NextResponse } from "next/server";

import { assertBrandMember, listPrompts } from "@/lib/ai-search";
import { notFound } from "@/lib/api/respond";
import { isUuid, withApiKey } from "@/lib/api/route";
import { serializePrompt } from "@/lib/api/serialize";

/** GET /api/v1/brands/{id}/prompts → the brand's prompts (questions). */
export const GET = withApiKey(
  async (auth, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    if (!isUuid(id)) return notFound("Brand");
    if (!(await assertBrandMember(auth.userId, id))) return notFound("Brand");

    const prompts = await listPrompts(id);
    return NextResponse.json({ prompts: prompts.map(serializePrompt) });
  },
);

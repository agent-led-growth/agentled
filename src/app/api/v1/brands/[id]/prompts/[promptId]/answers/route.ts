import { NextResponse } from "next/server";

import { assertBrandMember, getPromptAnswers, getPromptById } from "@/lib/ai-search";
import { notFound } from "@/lib/api/respond";
import { isUuid, withApiKey } from "@/lib/api/route";
import { serializeAnswer } from "@/lib/api/serialize";

/**
 * GET /api/v1/brands/{id}/prompts/{promptId}/answers → the per-run answer history
 * for one prompt (each completed scan's answer, plus the brands it named and the
 * domains it cited). Mirrors the app's prompt-detail navigator.
 */
export const GET = withApiKey(
  async (auth, { params }: { params: Promise<{ id: string; promptId: string }> }) => {
    const { id, promptId } = await params;
    if (!isUuid(id) || !isUuid(promptId)) return notFound("Prompt");
    if (!(await assertBrandMember(auth.userId, id))) return notFound("Prompt");

    // The prompt must belong to this brand — else it's a 404, never another
    // brand's prompt (getPromptAnswers is brand-scoped, but check explicitly).
    const prompt = await getPromptById(promptId);
    if (!prompt || prompt.brand_id !== id) return notFound("Prompt");

    const answers = await getPromptAnswers(id, promptId);
    return NextResponse.json({ answers: answers.map(serializeAnswer) });
  },
);

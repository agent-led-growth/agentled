import { NextResponse } from "next/server";

import { assertBrandMember, getPromptAnswers, getPromptForBrand } from "@/lib/ai-search";
import { pageResult, parsePagination } from "@/lib/api/pagination";
import { notFound } from "@/lib/api/respond";
import { isUuid, withApiKey } from "@/lib/api/route";
import { serializeAnswer } from "@/lib/api/serialize";

/**
 * GET /api/v1/brands/{id}/prompts/{promptId}/answers?limit=&offset= → the per-run
 * answer history for one prompt (each completed scan's answer, plus the brands it
 * named and domains it cited). Mirrors the app's prompt-detail navigator.
 *
 * Note: `limit`/`offset` page over completed *runs*; a run in which the prompt had
 * no answer yet is skipped, so a page can return fewer than `limit` answers.
 */
export const GET = withApiKey(
  async (auth, { params }: { params: Promise<{ id: string; promptId: string }> }, request) => {
    const { id, promptId } = await params;
    if (!isUuid(id) || !isUuid(promptId)) return notFound("Prompt");
    if (!(await assertBrandMember(auth.userId, id))) return notFound("Prompt");
    // The prompt must belong to this brand — else 404, never another brand's prompt.
    if (!(await getPromptForBrand(promptId, id))) return notFound("Prompt");

    const { limit, offset } = parsePagination(request);
    const rows = await getPromptAnswers(id, promptId, limit + 1, offset);
    const { items, hasMore } = pageResult(rows, limit);
    return NextResponse.json({
      answers: items.map(serializeAnswer),
      pagination: { limit, offset, hasMore },
    });
  },
);

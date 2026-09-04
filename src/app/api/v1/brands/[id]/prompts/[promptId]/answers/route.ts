import { NextResponse } from "next/server";

import { serviceError } from "@/lib/api/respond";
import { withApiKey } from "@/lib/api/route";
import { serializeAnswer } from "@/lib/api/serialize";
import { listAnswersForPrompt } from "@/lib/api/services";

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
    const sp = new URL(request.url).searchParams;
    const result = await listAnswersForPrompt(auth.userId, id, promptId, {
      limit: sp.get("limit"),
      offset: sp.get("offset"),
    });
    if (!result.ok) return serviceError(result.error);
    return NextResponse.json({
      answers: result.data.items.map(serializeAnswer),
      pagination: result.data.pagination,
    });
  },
);

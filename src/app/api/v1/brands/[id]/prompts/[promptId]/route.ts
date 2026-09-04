import { NextResponse } from "next/server";

import { serviceError } from "@/lib/api/respond";
import { withApiKey } from "@/lib/api/route";
import { serializePrompt } from "@/lib/api/serialize";
import { updatePromptForUser } from "@/lib/api/services";

/**
 * PATCH /api/v1/brands/{id}/prompts/{promptId}  { text?, active? } → edit a
 * prompt's question and/or enable/disable it. `active:false` disables a prompt
 * (it stops running but is kept, with its scan history); `active:true` re-enables
 * it and counts against the account prompt limit. Prompts are never hard-deleted.
 *
 * Logic lives in `updatePromptForUser` (shared with MCP): all validation and the
 * limit check run before ANY write, so a rejected request never leaves a partial
 * change.
 */
export const PATCH = withApiKey(
  async (auth, { params }: { params: Promise<{ id: string; promptId: string }> }, request) => {
    const { id, promptId } = await params;
    const body = (await request.json().catch(() => ({}))) as { text?: unknown; active?: unknown };
    const result = await updatePromptForUser(auth.userId, id, promptId, body);
    if (!result.ok) return serviceError(result.error);
    return NextResponse.json({ prompt: serializePrompt(result.data.prompt) });
  },
);

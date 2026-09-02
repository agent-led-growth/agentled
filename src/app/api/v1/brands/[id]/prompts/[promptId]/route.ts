import { NextResponse } from "next/server";

import { assertBrandMember, getPromptForBrand, setPromptActive, updatePromptText } from "@/lib/ai-search";
import { apiError, badRequest, notFound } from "@/lib/api/respond";
import { isUuid, withApiKey } from "@/lib/api/route";
import { serializePrompt } from "@/lib/api/serialize";
import { promptUsage } from "@/lib/api/usage";

const MAX_PROMPT_LEN = 300;

/**
 * PATCH /api/v1/brands/{id}/prompts/{promptId}  { text?, active? } → edit a
 * prompt's question and/or its active state. Reactivating (active:true) counts
 * against the account prompt limit.
 */
export const PATCH = withApiKey(
  async (auth, { params }: { params: Promise<{ id: string; promptId: string }> }, request) => {
    const { id, promptId } = await params;
    if (!isUuid(id) || !isUuid(promptId)) return notFound("Prompt");
    if (!(await assertBrandMember(auth.userId, id))) return notFound("Prompt");
    const prompt = await getPromptForBrand(promptId, id);
    if (!prompt) return notFound("Prompt");

    const body = (await request.json().catch(() => ({}))) as { text?: unknown; active?: unknown };

    if (body.text !== undefined) {
      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (!text) return badRequest("text must be a non-empty string.");
      if (text.length > MAX_PROMPT_LEN)
        return badRequest(`text must be at most ${MAX_PROMPT_LEN} characters.`);
      await updatePromptText(promptId, text);
    }

    if (body.active !== undefined) {
      if (typeof body.active !== "boolean") return badRequest("active must be a boolean.");
      // Turning a prompt back on consumes a slot — enforce the account cap.
      if (body.active && !prompt.active) {
        const { used, limit } = await promptUsage(auth.userId);
        if (used >= limit)
          return apiError(409, "limit_reached", `Prompt limit reached (${used}/${limit}).`);
      }
      await setPromptActive(promptId, body.active);
    }

    if (body.text === undefined && body.active === undefined)
      return badRequest("Provide 'text' and/or 'active'.");

    const updated = await getPromptForBrand(promptId, id);
    return NextResponse.json({ prompt: updated ? serializePrompt(updated) : null });
  },
);

/** DELETE /api/v1/brands/{id}/prompts/{promptId} → soft-deactivate (history kept). */
export const DELETE = withApiKey(
  async (auth, { params }: { params: Promise<{ id: string; promptId: string }> }) => {
    const { id, promptId } = await params;
    if (!isUuid(id) || !isUuid(promptId)) return notFound("Prompt");
    if (!(await assertBrandMember(auth.userId, id))) return notFound("Prompt");
    if (!(await getPromptForBrand(promptId, id))) return notFound("Prompt");

    await setPromptActive(promptId, false);
    return NextResponse.json({ ok: true });
  },
);

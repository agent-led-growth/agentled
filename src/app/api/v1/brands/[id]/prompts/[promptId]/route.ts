import { NextResponse } from "next/server";

import { assertBrandMember, getPromptForBrand, setPromptActive, updatePromptText } from "@/lib/ai-search";
import { badRequest, limitReached, notFound } from "@/lib/api/respond";
import { isUuid, withApiKey } from "@/lib/api/route";
import { serializePrompt } from "@/lib/api/serialize";
import { promptUsage } from "@/lib/api/usage";

const MAX_PROMPT_LEN = 300;

/**
 * PATCH /api/v1/brands/{id}/prompts/{promptId}  { text?, active? } → edit a
 * prompt's question and/or enable/disable it. `active:false` disables a prompt
 * (it stops running but is kept, with its scan history); `active:true` re-enables
 * it and counts against the account prompt limit. Prompts are never hard-deleted.
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
      // Enabling a disabled prompt consumes a slot — enforce the account cap.
      if (body.active && !prompt.active) {
        const { used, limit } = await promptUsage(auth.userId);
        if (used >= limit)
          return limitReached(
            `You've reached your plan's prompt limit (${used}/${limit}). Upgrade to add more.`,
          );
      }
      await setPromptActive(promptId, body.active);
    }

    if (body.text === undefined && body.active === undefined)
      return badRequest("Provide 'text' and/or 'active'.");

    const updated = await getPromptForBrand(promptId, id);
    return NextResponse.json({ prompt: updated ? serializePrompt(updated) : null });
  },
);

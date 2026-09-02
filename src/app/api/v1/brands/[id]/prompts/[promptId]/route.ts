import { NextResponse } from "next/server";

import {
  assertBrandMember,
  getPromptForBrand,
  MAX_PROMPT_TEXT_LEN,
  setPromptActive,
  updatePromptText,
} from "@/lib/ai-search";
import { badRequest, limitReached, notFound } from "@/lib/api/respond";
import { isUuid, withApiKey } from "@/lib/api/route";
import { serializePrompt } from "@/lib/api/serialize";
import { promptUsage } from "@/lib/api/usage";

/**
 * PATCH /api/v1/brands/{id}/prompts/{promptId}  { text?, active? } → edit a
 * prompt's question and/or enable/disable it. `active:false` disables a prompt
 * (it stops running but is kept, with its scan history); `active:true` re-enables
 * it and counts against the account prompt limit. Prompts are never hard-deleted.
 *
 * All validation and the limit check run before ANY write, so a rejected request
 * never leaves a partial change (e.g. text edited but activation refused).
 */
export const PATCH = withApiKey(
  async (auth, { params }: { params: Promise<{ id: string; promptId: string }> }, request) => {
    const { id, promptId } = await params;
    if (!isUuid(id) || !isUuid(promptId)) return notFound("Prompt");
    if (!(await assertBrandMember(auth.userId, id))) return notFound("Prompt");
    const prompt = await getPromptForBrand(promptId, id);
    if (!prompt) return notFound("Prompt");

    const body = (await request.json().catch(() => ({}))) as { text?: unknown; active?: unknown };
    const hasText = body.text !== undefined;
    const hasActive = body.active !== undefined;
    if (!hasText && !hasActive) return badRequest("Provide 'text' and/or 'active'.");

    // ── Validate everything first — no mutation until all checks pass ──
    let newText: string | undefined;
    if (hasText) {
      const t = typeof body.text === "string" ? body.text.trim() : "";
      if (!t) return badRequest("text must be a non-empty string.");
      if (t.length > MAX_PROMPT_TEXT_LEN)
        return badRequest(`text must be at most ${MAX_PROMPT_TEXT_LEN} characters.`);
      newText = t;
    }
    let newActive: boolean | undefined;
    if (hasActive) {
      if (typeof body.active !== "boolean") return badRequest("active must be a boolean.");
      newActive = body.active;
      // Enabling a disabled prompt consumes a slot — enforce the account cap.
      if (newActive && !prompt.active) {
        const { used, limit } = await promptUsage(auth.userId);
        if (used >= limit)
          return limitReached(
            `You've reached your plan's prompt limit (${used}/${limit}). Upgrade to add more.`,
          );
      }
    }

    // ── Apply ──
    if (newText !== undefined) await updatePromptText(promptId, newText);
    if (newActive !== undefined) await setPromptActive(promptId, newActive);

    // Build the response from known state — both writes bump updated_at to ~now.
    const result = {
      ...prompt,
      text: newText ?? prompt.text,
      active: newActive ?? prompt.active,
      updated_at: new Date().toISOString(),
    };
    return NextResponse.json({ prompt: serializePrompt(result) });
  },
);

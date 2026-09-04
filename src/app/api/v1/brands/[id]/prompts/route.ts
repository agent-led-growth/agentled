import { NextResponse } from "next/server";

import {
  assertBrandMember,
  countActivePrompts,
  createPrompt,
  listPrompts,
  MAX_PROMPT_TEXT_LEN,
  setPromptActive,
} from "@/lib/ai-search";
import { pageResult, parsePagination } from "@/lib/api/pagination";
import { badRequest, limitReached, notFound } from "@/lib/api/respond";
import { isUuid, withApiKey } from "@/lib/api/route";
import { serializePrompt } from "@/lib/api/serialize";
import { promptUsage } from "@/lib/api/usage";

/** Parse the `active` filter: true/false (case-insensitive), absent, or invalid. */
function parseActive(v: string | null): boolean | undefined | "invalid" {
  if (v === null) return undefined;
  const s = v.toLowerCase();
  if (s === "true") return true;
  if (s === "false") return false;
  return "invalid";
}

/**
 * GET /api/v1/brands/{id}/prompts?active=&limit=&offset= → the brand's prompts,
 * active and inactive by default. A "removed" prompt is a soft delete
 * (active=false), kept for history; `?active=true|false` filters it.
 */
export const GET = withApiKey(
  async (auth, { params }: { params: Promise<{ id: string }> }, request) => {
    const { id } = await params;
    if (!isUuid(id)) return notFound("Brand");
    if (!(await assertBrandMember(auth.userId, id))) return notFound("Brand");

    const active = parseActive(new URL(request.url).searchParams.get("active"));
    if (active === "invalid") return badRequest("active must be 'true' or 'false'.");

    const { limit, offset } = parsePagination(request);
    const rows = await listPrompts(id, { active, limit: limit + 1, offset });
    const { items, hasMore } = pageResult(rows, limit);
    return NextResponse.json({
      prompts: items.map(serializePrompt),
      pagination: { limit, offset, hasMore },
    });
  },
);

/**
 * POST /api/v1/brands/{id}/prompts  { text } → add a prompt. Enforces the
 * account-wide plan prompt limit (409 when reached).
 */
export const POST = withApiKey(
  async (auth, { params }: { params: Promise<{ id: string }> }, request) => {
    const { id } = await params;
    if (!isUuid(id)) return notFound("Brand");
    if (!(await assertBrandMember(auth.userId, id))) return notFound("Brand");

    const body = (await request.json().catch(() => ({}))) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return badRequest("text is required.");
    if (text.length > MAX_PROMPT_TEXT_LEN)
      return badRequest(`text must be at most ${MAX_PROMPT_TEXT_LEN} characters.`);

    const { used, limit, brandIds } = await promptUsage(auth.userId);
    if (used >= limit)
      return limitReached(
        `You've reached your plan's prompt limit (${used}/${limit}). Upgrade to add more.`,
      );

    const prompt = await createPrompt(id, text);
    // The check + insert aren't atomic; re-count active prompts (plan/brands can't
    // change mid-request) and soft-roll-back if a concurrent add pushed over the cap.
    const after = brandIds.length ? await countActivePrompts(brandIds) : 0;
    if (after > limit) {
      await setPromptActive(prompt.id, false);
      return limitReached(
        `You've reached your plan's prompt limit (${limit}/${limit}). Upgrade to add more.`,
      );
    }
    return NextResponse.json(
      { prompt: serializePrompt(prompt), usage: { used: after, limit } },
      { status: 201 },
    );
  },
);

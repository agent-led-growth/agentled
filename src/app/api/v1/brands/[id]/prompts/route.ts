import { NextResponse } from "next/server";

import { serviceError } from "@/lib/api/respond";
import { withApiKey } from "@/lib/api/route";
import { serializePrompt } from "@/lib/api/serialize";
import { addPromptForUser, listPromptsForBrand } from "@/lib/api/services";

/**
 * GET /api/v1/brands/{id}/prompts?active=&limit=&offset= → the brand's prompts,
 * active and inactive by default. A "removed" prompt is a soft delete
 * (active=false), kept for history; `?active=true|false` filters it. Logic lives
 * in `listPromptsForBrand` (shared with MCP).
 */
export const GET = withApiKey(
  async (auth, { params }: { params: Promise<{ id: string }> }, request) => {
    const { id } = await params;
    const sp = new URL(request.url).searchParams;
    const result = await listPromptsForBrand(auth.userId, id, {
      active: sp.get("active"),
      limit: sp.get("limit"),
      offset: sp.get("offset"),
    });
    if (!result.ok) return serviceError(result.error);
    return NextResponse.json({
      prompts: result.data.items.map(serializePrompt),
      pagination: result.data.pagination,
    });
  },
);

/**
 * POST /api/v1/brands/{id}/prompts  { text } → add a prompt. Enforces the
 * account-wide plan prompt limit (409 when reached). Logic lives in
 * `addPromptForUser` (shared with MCP).
 */
export const POST = withApiKey(
  async (auth, { params }: { params: Promise<{ id: string }> }, request) => {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { text?: unknown };
    const result = await addPromptForUser(auth.userId, id, body.text);
    if (!result.ok) return serviceError(result.error);
    return NextResponse.json(
      { prompt: serializePrompt(result.data.prompt), usage: result.data.usage },
      { status: 201 },
    );
  },
);

import { NextResponse } from "next/server";

import { badRequest, serviceError } from "@/lib/api/respond";
import { withApiKey } from "@/lib/api/route";
import { serializePrompt } from "@/lib/api/serialize";
import { addPromptForUser, listPromptsForBrand } from "@/lib/api/services";

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
    const sp = new URL(request.url).searchParams;
    const active = parseActive(sp.get("active"));
    if (active === "invalid") return badRequest("active must be 'true' or 'false'.");

    const result = await listPromptsForBrand(auth.userId, id, {
      active,
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

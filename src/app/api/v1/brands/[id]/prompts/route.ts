import { NextResponse } from "next/server";

import { assertBrandMember, listPrompts } from "@/lib/ai-search";
import { pageResult, parsePagination } from "@/lib/api/pagination";
import { badRequest, notFound } from "@/lib/api/respond";
import { isUuid, withApiKey } from "@/lib/api/route";
import { serializePrompt } from "@/lib/api/serialize";

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

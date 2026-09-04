import { NextResponse } from "next/server";

import { serviceError } from "@/lib/api/respond";
import { withApiKey } from "@/lib/api/route";
import { serializeBrand } from "@/lib/api/serialize";
import { createBrandForUser, listBrandsForUser } from "@/lib/api/services";

/** GET /api/v1/brands?limit=&offset= → the account's brands, newest first. */
export const GET = withApiKey(async (auth, _ctx, request) => {
  const sp = new URL(request.url).searchParams;
  const { items, pagination } = await listBrandsForUser(auth.userId, {
    limit: sp.get("limit"),
    offset: sp.get("offset"),
  });
  return NextResponse.json({ brands: items.map(serializeBrand), pagination });
});

/**
 * POST /api/v1/brands  { website, about? } → create a brand owned by the account
 * and enrich it (name / description / logo). Enforces the plan's brand limit
 * (409 when reached). Prompts are NOT created here — add them via
 * POST /brands/{id}/prompts. Idempotent per (account, domain): re-posting a
 * website the account already has returns that brand (200) rather than
 * duplicating it. Logic lives in `createBrandForUser` (shared with MCP).
 */
export const POST = withApiKey(async (auth, _ctx, request) => {
  const body = (await request.json().catch(() => ({}))) as { website?: unknown; about?: unknown };
  const result = await createBrandForUser(auth.userId, body);
  if (!result.ok) return serviceError(result.error);
  return NextResponse.json(
    { brand: serializeBrand(result.data.brand) },
    { status: result.data.created ? 201 : 200 },
  );
});

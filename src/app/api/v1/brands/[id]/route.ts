import { NextResponse } from "next/server";

import { getBrandForMember } from "@/lib/ai-search";
import { notFound, serviceError } from "@/lib/api/respond";
import { isUuid, withApiKey } from "@/lib/api/route";
import { serializeBrand } from "@/lib/api/serialize";
import { setBrandLocationForUser } from "@/lib/api/services";

/** GET /api/v1/brands/{id} → one brand the account belongs to. */
export const GET = withApiKey(
  async (auth, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    if (!isUuid(id)) return notFound("Brand");

    const brand = await getBrandForMember(auth.userId, id);
    if (!brand) return notFound("Brand");
    return NextResponse.json({ brand: serializeBrand(brand) });
  },
);

/**
 * PATCH /api/v1/brands/{id}  { location } → update the brand's measurement
 * location. `location.mode` is required (worldwide | country | city); an invalid
 * country/city is rejected with 400. Returns the updated brand. Logic lives in
 * `setBrandLocationForUser` (shared with MCP).
 *
 * Topics are deliberately not part of the public API; edit prompts directly via
 * the prompt endpoints instead.
 */
export const PATCH = withApiKey(
  async (auth, { params }: { params: Promise<{ id: string }> }, request) => {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { location?: unknown };
    const result = await setBrandLocationForUser(auth.userId, id, body.location);
    if (!result.ok) return serviceError(result.error);
    return NextResponse.json({ brand: result.data.brand ? serializeBrand(result.data.brand) : null });
  },
);

import { NextResponse } from "next/server";

import { assertBrandMember, getBrandForMember, updateBrandLocation } from "@/lib/ai-search";
import { normalizeBrandLocation, type LocationInput } from "@/lib/geo/location";
import { badRequest, notFound } from "@/lib/api/respond";
import { isUuid, withApiKey } from "@/lib/api/route";
import { serializeBrand } from "@/lib/api/serialize";

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
 * country/city is rejected with 400. Returns the updated brand.
 *
 * Topics are deliberately not part of the public API (they organize prompts for
 * the initial free scan and are managed only during onboarding); edit prompts
 * directly via the prompt endpoints instead.
 */
export const PATCH = withApiKey(
  async (auth, { params }: { params: Promise<{ id: string }> }, request) => {
    const { id } = await params;
    if (!isUuid(id)) return notFound("Brand");
    if (!(await assertBrandMember(auth.userId, id))) return notFound("Brand");

    const body = (await request.json().catch(() => ({}))) as { location?: unknown };
    if (body.location === undefined) return badRequest("Provide 'location'.");

    const loc = body.location;
    if (loc === null || typeof loc !== "object" || Array.isArray(loc))
      return badRequest("location must be an object.");
    const input = loc as LocationInput;
    const mode = input.mode ?? undefined;
    // Require an explicit mode, so an empty/partial object can't silently reset
    // a scoped brand to worldwide. Send { mode: "worldwide" } to clear scope.
    if (mode !== "worldwide" && mode !== "country" && mode !== "city")
      return badRequest("location.mode is required: 'worldwide', 'country', or 'city'.");
    const normalized = normalizeBrandLocation(input);
    if ((mode === "country" || mode === "city") && normalized.mode === "worldwide")
      return badRequest("location.country is not a valid ISO 3166-1 alpha-2 code.");
    if (mode === "city" && normalized.mode === "country")
      return badRequest("location.city is not a recognized city for that country.");

    await updateBrandLocation(id, input);

    const brand = await getBrandForMember(auth.userId, id);
    return NextResponse.json({ brand: brand ? serializeBrand(brand) : null });
  },
);

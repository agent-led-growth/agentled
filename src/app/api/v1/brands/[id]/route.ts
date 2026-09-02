import { NextResponse } from "next/server";

import {
  assertBrandMember,
  getBrandForMember,
  listSelectedTopics,
  setSelectedTopics,
  updateBrandLocation,
} from "@/lib/ai-search";
import type { Brand } from "@/lib/ai-search";
import { normalizeBrandLocation, type LocationInput } from "@/lib/geo/location";
import { badRequest, notFound } from "@/lib/api/respond";
import { isUuid, withApiKey } from "@/lib/api/route";
import { serializeBrand } from "@/lib/api/serialize";

/** Brand shape for the API, with its selected topic labels. */
async function brandPayload(brand: Brand) {
  const topics = await listSelectedTopics(brand.id);
  return { ...serializeBrand(brand), topics: topics.map((t) => t.label) };
}

/** GET /api/v1/brands/{id} → one brand the account belongs to (with its topics). */
export const GET = withApiKey(
  async (auth, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    if (!isUuid(id)) return notFound("Brand");

    const brand = await getBrandForMember(auth.userId, id);
    if (!brand) return notFound("Brand");
    return NextResponse.json({ brand: await brandPayload(brand) });
  },
);

/**
 * PATCH /api/v1/brands/{id}  { location?, topics? } → update the brand's
 * measurement location and/or its selected topics. `location` is validated (an
 * invalid country/city is rejected with 400, not silently degraded); `topics` is
 * a list of labels. All input is validated before anything is written. Returns
 * the updated brand.
 */
export const PATCH = withApiKey(
  async (auth, { params }: { params: Promise<{ id: string }> }, request) => {
    const { id } = await params;
    if (!isUuid(id)) return notFound("Brand");
    if (!(await assertBrandMember(auth.userId, id))) return notFound("Brand");

    const body = (await request.json().catch(() => ({}))) as {
      location?: unknown;
      topics?: unknown;
    };
    if (body.location === undefined && body.topics === undefined)
      return badRequest("Provide 'location' and/or 'topics'.");

    // ── Validate everything first — no mutation until all checks pass ──
    let labels: string[] | undefined;
    if (body.topics !== undefined) {
      if (!Array.isArray(body.topics)) return badRequest("topics must be an array of strings.");
      labels = body.topics
        .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        .map((t) => t.trim().slice(0, 200))
        .slice(0, 50);
    }

    let locInput: LocationInput | undefined;
    if (body.location !== undefined) {
      const loc = body.location;
      if (loc === null || typeof loc !== "object" || Array.isArray(loc))
        return badRequest("location must be an object.");
      const input = loc as LocationInput;
      const mode = input.mode ?? undefined;
      if (mode != null && mode !== "worldwide" && mode !== "country" && mode !== "city")
        return badRequest("location.mode must be 'worldwide', 'country', or 'city'.");
      const normalized = normalizeBrandLocation(input);
      if ((mode === "country" || mode === "city") && normalized.mode === "worldwide")
        return badRequest("location.country is not a valid ISO 3166-1 alpha-2 code.");
      if (mode === "city" && normalized.mode === "country")
        return badRequest("location.city is not a recognized city for that country.");
      locInput = input;
    }

    // ── Apply ──
    if (labels !== undefined) await setSelectedTopics(id, labels);
    if (locInput !== undefined) await updateBrandLocation(id, locInput);

    const brand = await getBrandForMember(auth.userId, id);
    return NextResponse.json({ brand: brand ? await brandPayload(brand) : null });
  },
);

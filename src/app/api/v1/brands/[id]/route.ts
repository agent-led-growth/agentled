import { NextResponse } from "next/server";

import {
  assertBrandMember,
  getBrandForMember,
  setSelectedTopics,
  updateBrandLocation,
} from "@/lib/ai-search";
import type { LocationInput } from "@/lib/geo/location";
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
 * PATCH /api/v1/brands/{id}  { location?, topics? } → update the brand's
 * measurement location and/or its selected topics. `location` is re-validated
 * server-side (an invalid value degrades to worldwide); `topics` is a list of
 * topic labels. Returns the updated brand.
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

    if (body.topics !== undefined) {
      if (!Array.isArray(body.topics)) return badRequest("topics must be an array of strings.");
      const labels = body.topics
        .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        .map((t) => t.trim().slice(0, 200))
        .slice(0, 50);
      await setSelectedTopics(id, labels);
    }

    if (body.location !== undefined) {
      // updateBrandLocation normalizes/validates; an invalid value degrades to
      // worldwide (same as onboarding), and the response shows what was applied.
      await updateBrandLocation(id, body.location as LocationInput);
    }

    const brand = await getBrandForMember(auth.userId, id);
    return NextResponse.json({ brand: brand ? serializeBrand(brand) : null });
  },
);

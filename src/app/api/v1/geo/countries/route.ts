import { NextResponse } from "next/server";

import { withApiKey } from "@/lib/api/route";
import { COUNTRIES } from "@/lib/geo/countries";

/**
 * GET /api/v1/geo/countries → every country a brand can be scoped to, as
 * { code, name } where `code` is the ISO-3166-1 alpha-2 value to send as
 * `location.country` on PATCH /brands/{id}. Static reference data.
 */
export const GET = withApiKey(async () => {
  return NextResponse.json(
    { countries: COUNTRIES },
    { headers: { "cache-control": "public, max-age=86400" } },
  );
});

import { NextResponse } from "next/server";

import { serviceError } from "@/lib/api/respond";
import { withApiKey } from "@/lib/api/route";
import { resolveCities } from "@/lib/api/services";

/**
 * GET /api/v1/geo/countries/{code}/cities → the cities that can be sent as
 * `location.city` for this country (GeoNames, population ≥ 100k). 404 if the
 * country code is invalid; an empty list means only country-level scope is
 * available. `{code}` is case-insensitive (ISO-3166-1 alpha-2). Logic lives in
 * `resolveCities` (shared with MCP).
 */
export const GET = withApiKey(
  async (_auth, { params }: { params: Promise<{ code: string }> }) => {
    const { code } = await params;
    const result = resolveCities(code);
    if (!result.ok) return serviceError(result.error);
    return NextResponse.json(result.data, {
      headers: { "cache-control": "public, max-age=86400" },
    });
  },
);

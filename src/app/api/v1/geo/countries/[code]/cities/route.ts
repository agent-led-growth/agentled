import { NextResponse } from "next/server";

import { notFound } from "@/lib/api/respond";
import { withApiKey } from "@/lib/api/route";
import { citiesForCountry } from "@/lib/geo/cities";
import { countryName, isValidCountry } from "@/lib/geo/countries";

/**
 * GET /api/v1/geo/countries/{code}/cities → the cities that can be sent as
 * `location.city` for this country (GeoNames, population ≥ 100k). 404 if the
 * country code is invalid; an empty list means only country-level scope is
 * available. `{code}` is case-insensitive (ISO-3166-1 alpha-2).
 */
export const GET = withApiKey(
  async (_auth, { params }: { params: Promise<{ code: string }> }) => {
    const { code: raw } = await params;
    const code = raw.toUpperCase();
    if (!isValidCountry(code)) return notFound("Country");
    return NextResponse.json(
      { country: { code, name: countryName(code) ?? code }, cities: citiesForCountry(code) },
      { headers: { "cache-control": "public, max-age=86400" } },
    );
  },
);

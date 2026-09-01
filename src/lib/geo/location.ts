import type { BrandLocation, LocationMode } from "@/lib/ai-search/types";

import { citiesForCountry, isValidCity } from "./cities";
import { countryName, isValidCountry } from "./countries";

/**
 * Location targeting helpers, shared by the onboarding client (to render a label)
 * and the server (as the authoritative validity gate). Pure — no server-only, no
 * network — so both sides normalise a raw, untrusted selection the same way.
 */

/** A raw, untrusted location selection off the wire or from the picker. */
export interface LocationInput {
  mode?: string | null;
  country?: string | null;
  city?: string | null;
}

const WORLDWIDE: BrandLocation = {
  mode: "worldwide",
  country: null,
  city: null,
  label: null,
};

/**
 * Coerce an arbitrary selection into a valid, canonical BrandLocation, degrading
 * rather than rejecting: an unknown country → worldwide; a city that isn't in its
 * country → country-only. This is the single source of truth for what gets stored
 * and measured, so a client that bypasses the picker can't persist a bogus place.
 */
export function normalizeBrandLocation(input: LocationInput | null | undefined): BrandLocation {
  if (!input) return WORLDWIDE;

  const mode = input.mode as LocationMode | undefined;
  if (mode !== "country" && mode !== "city") return WORLDWIDE;

  const country = input.country?.trim().toUpperCase() || "";
  if (!isValidCountry(country)) return WORLDWIDE;
  const cName = countryName(country)!;

  if (mode === "city") {
    const city = input.city?.trim() || "";
    if (city && isValidCity(country, city)) {
      // Canonicalise to the dataset's spelling/casing for a stable stored value.
      const target = city.toLowerCase();
      const canonical =
        citiesForCountry(country).find((c) => c.toLowerCase() === target) ?? city;
      return { mode: "city", country, city: canonical, label: `${canonical}, ${cName}` };
    }
    // No/invalid city → fall back to country scope.
  }

  return { mode: "country", country, city: null, label: cName };
}

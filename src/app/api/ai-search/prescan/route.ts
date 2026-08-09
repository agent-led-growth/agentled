import { NextResponse } from "next/server";

import {
  createAnonymousBrand,
  enrichBrand,
  getOrCreateActiveBrandForUser,
  getUserIdByAuthId,
  resetSuggestedTopics,
  updateBrandEnrichment,
  type Brand,
} from "@/lib/laurel";
import { createClient } from "@/lib/supabase/server";

/**
 * Pre-scan (step 1–2). On website-submit: create the brand, run enrichment
 * synchronously, persist name/description/logo + suggested topics, and return
 * everything the onboarding UI needs — including `brandId`, which the client
 * carries through the OTP so the gate can attach the user to this exact brand.
 *
 * Unauthenticated by design (pre-gate). A signed-in visitor skips the anonymous
 * phase: their brand is born `active` and owned. Enrichment is best-effort;
 * failures degrade to a domain-only brand rather than blocking onboarding.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const website =
    typeof body.website === "string" && body.website.trim()
      ? body.website.trim().slice(0, 2048)
      : null;
  if (!website) {
    return NextResponse.json({ error: "Enter a website." }, { status: 400 });
  }
  const about =
    typeof body.about === "string" && body.about.trim()
      ? body.about.trim().slice(0, 5000)
      : undefined;

  try {
    // Already signed in → brand is born active + owned; else anonymous.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let brand: Brand;
    if (user) {
      const userId = await getUserIdByAuthId(user.id);
      brand = userId
        ? await getOrCreateActiveBrandForUser(website, userId)
        : await createAnonymousBrand(website);
    } else {
      brand = await createAnonymousBrand(website);
    }

    // Enrich (reader + generation + logo), then persist. Best-effort.
    const enrichment = await enrichBrand(brand.domain, about);
    await updateBrandEnrichment(brand.id, {
      name: enrichment.name,
      description: enrichment.description,
      logoUrl: enrichment.logoUrl,
    });
    // Reset (not append): on a reused brand this replaces stale suggestions.
    const topics = await resetSuggestedTopics(brand.id, enrichment.topics);

    return NextResponse.json({
      brandId: brand.id,
      brand: {
        id: brand.id,
        domain: brand.domain,
        name: enrichment.name,
        description: enrichment.description,
        logoUrl: enrichment.logoUrl,
        status: brand.status,
      },
      topics: topics.map((t) => ({ id: t.id, label: t.label, selected: t.selected })),
    });
  } catch (err) {
    console.error("prescan: unexpected failure", err);
    return NextResponse.json(
      { error: "Could not start a scan right now. Please try again." },
      { status: 500 },
    );
  }
}

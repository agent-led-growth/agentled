import { NextResponse } from "next/server";

import {
  createActiveBrandForUser,
  enrichBrand,
  getBrandById,
  getBrandsForUserId,
  getMemberBrandByDomain,
  getPlanForUserId,
  isValidWebsite,
  updateBrandEnrichment,
} from "@/lib/ai-search";
import { pageResult, parsePagination } from "@/lib/api/pagination";
import { badRequest, limitReached } from "@/lib/api/respond";
import { withApiKey } from "@/lib/api/route";
import { serializeBrand } from "@/lib/api/serialize";
import { brandLimit } from "@/lib/plan";

/** GET /api/v1/brands?limit=&offset= → the account's brands, newest first. */
export const GET = withApiKey(async (auth, _ctx, request) => {
  const { limit, offset } = parsePagination(request);
  const rows = await getBrandsForUserId(auth.userId, limit + 1, offset);
  const { items, hasMore } = pageResult(rows, limit);
  return NextResponse.json({
    brands: items.map(serializeBrand),
    pagination: { limit, offset, hasMore },
  });
});

/**
 * POST /api/v1/brands  { website, about? } → create a brand owned by the account
 * and enrich it (name / description / logo). Enforces the plan's brand limit
 * (409 when reached). Prompts are NOT created here — add them via
 * POST /brands/{id}/prompts. Idempotent per (account, domain): re-posting a
 * website the account already has returns that brand rather than duplicating it.
 */
export const POST = withApiKey(async (auth, _ctx, request) => {
  const body = (await request.json().catch(() => ({}))) as { website?: unknown; about?: unknown };
  const website =
    typeof body.website === "string" && body.website.trim()
      ? body.website.trim().slice(0, 2048)
      : "";
  if (!website) return badRequest("website is required.");
  if (!isValidWebsite(website)) return badRequest("website must be a valid domain, like example.com.");
  const about =
    typeof body.about === "string" && body.about.trim()
      ? body.about.trim().slice(0, 5000)
      : undefined;

  // Idempotent: if the account already has a brand for this domain, return it
  // UNCHANGED — no re-enrichment (which would re-spend a model call and overwrite
  // name/description/logo) and it doesn't count against the brand limit.
  const existing = await getMemberBrandByDomain(auth.userId, website);
  if (existing) return NextResponse.json({ brand: serializeBrand(existing) });

  // A genuinely new brand → enforce the plan's brand limit.
  const [count, plan] = await Promise.all([
    getBrandsForUserId(auth.userId).then((b) => b.length),
    getPlanForUserId(auth.userId),
  ]);
  const limit = brandLimit(plan);
  if (count >= limit)
    return limitReached(
      `You've reached your plan's brand limit (${count}/${limit}). Upgrade to add more brands.`,
    );

  const brand = await createActiveBrandForUser(website, auth.userId);

  // Enrichment is best-effort (name/description/logo): a failure leaves a
  // domain-only brand rather than failing the create. Topics are deliberately NOT
  // stored — an API brand has no prompts and no topic auto-detection; prompts are
  // added explicitly via POST /brands/{id}/prompts, and with no prompts a scan is
  // a no-op (runScan skips).
  try {
    const e = await enrichBrand(brand.domain, about);
    await updateBrandEnrichment(brand.id, {
      name: e.name,
      description: e.description,
      logoUrl: e.logoUrl,
    });
  } catch (err) {
    console.error("POST /api/v1/brands: enrichment failed", err);
  }

  const fresh = (await getBrandById(brand.id)) ?? brand;
  return NextResponse.json({ brand: serializeBrand(fresh) }, { status: 201 });
});

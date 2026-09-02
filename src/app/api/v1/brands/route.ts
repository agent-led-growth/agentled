import { NextResponse } from "next/server";

import { getBrandsForUserId } from "@/lib/ai-search";
import { requireApiKey } from "@/lib/api-keys/auth";
import { serverError, unauthorized } from "@/lib/api/respond";
import { serializeBrand } from "@/lib/api/serialize";

/** GET /api/v1/brands → every brand on the account, newest first. */
export async function GET(request: Request) {
  try {
    const ctx = await requireApiKey(request);
    if (!ctx) return unauthorized();

    const brands = await getBrandsForUserId(ctx.userId);
    return NextResponse.json({ brands: brands.map(serializeBrand) });
  } catch (err) {
    console.error("GET /api/v1/brands", err);
    return serverError();
  }
}

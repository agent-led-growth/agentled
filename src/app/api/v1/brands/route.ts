import { NextResponse } from "next/server";

import { getBrandsForUserId } from "@/lib/ai-search";
import { withApiKey } from "@/lib/api/route";
import { serializeBrand } from "@/lib/api/serialize";

/** GET /api/v1/brands → every brand on the account, newest first. */
export const GET = withApiKey(async (auth) => {
  const brands = await getBrandsForUserId(auth.userId);
  return NextResponse.json({ brands: brands.map(serializeBrand) });
});

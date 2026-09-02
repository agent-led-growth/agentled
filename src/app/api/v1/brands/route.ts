import { NextResponse } from "next/server";

import { getBrandsForUserId } from "@/lib/ai-search";
import { pageResult, parsePagination } from "@/lib/api/pagination";
import { withApiKey } from "@/lib/api/route";
import { serializeBrand } from "@/lib/api/serialize";

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

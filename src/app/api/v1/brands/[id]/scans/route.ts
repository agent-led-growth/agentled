import { NextResponse } from "next/server";

import { assertBrandMember, listRunsForBrand } from "@/lib/ai-search";
import { pageResult, parsePagination } from "@/lib/api/pagination";
import { notFound } from "@/lib/api/respond";
import { isUuid, withApiKey } from "@/lib/api/route";
import { serializeScan } from "@/lib/api/serialize";

/** GET /api/v1/brands/{id}/scans?limit=&offset= → the brand's scan runs, newest first. */
export const GET = withApiKey(
  async (auth, { params }: { params: Promise<{ id: string }> }, request) => {
    const { id } = await params;
    if (!isUuid(id)) return notFound("Brand");
    if (!(await assertBrandMember(auth.userId, id))) return notFound("Brand");

    const { limit, offset } = parsePagination(request, 90);
    const rows = await listRunsForBrand(id, limit + 1, offset);
    const { items, hasMore } = pageResult(rows, limit);
    return NextResponse.json({
      scans: items.map(serializeScan),
      pagination: { limit, offset, hasMore },
    });
  },
);

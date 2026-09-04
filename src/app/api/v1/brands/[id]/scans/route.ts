import { NextResponse } from "next/server";

import { serviceError } from "@/lib/api/respond";
import { withApiKey } from "@/lib/api/route";
import { serializeScan } from "@/lib/api/serialize";
import { listScansForBrand } from "@/lib/api/services";

/** GET /api/v1/brands/{id}/scans?limit=&offset= → the brand's scan runs, newest first. */
export const GET = withApiKey(
  async (auth, { params }: { params: Promise<{ id: string }> }, request) => {
    const { id } = await params;
    const sp = new URL(request.url).searchParams;
    const result = await listScansForBrand(auth.userId, id, {
      limit: sp.get("limit"),
      offset: sp.get("offset"),
    });
    if (!result.ok) return serviceError(result.error);
    return NextResponse.json({
      scans: result.data.items.map(serializeScan),
      pagination: result.data.pagination,
    });
  },
);

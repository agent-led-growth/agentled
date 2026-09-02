import { NextResponse } from "next/server";

import { getBrandForMember, listRunsForBrand } from "@/lib/ai-search";
import { notFound } from "@/lib/api/respond";
import { isUuid, withApiKey } from "@/lib/api/route";
import { serializeScan } from "@/lib/api/serialize";

/** GET /api/v1/brands/{id}/scans → the brand's scan runs, newest first. */
export const GET = withApiKey(
  async (auth, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    if (!isUuid(id)) return notFound("Brand");
    if (!(await getBrandForMember(auth.userId, id))) return notFound("Brand");

    const runs = await listRunsForBrand(id);
    return NextResponse.json({ scans: runs.map(serializeScan) });
  },
);

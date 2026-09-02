import { NextResponse } from "next/server";

import { isBrandMember, listRunsForBrand } from "@/lib/ai-search";
import { requireApiKey } from "@/lib/api-keys/auth";
import { notFound, serverError, unauthorized } from "@/lib/api/respond";
import { serializeScan } from "@/lib/api/serialize";

/** GET /api/v1/brands/{id}/scans → the brand's scan runs, newest first. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireApiKey(request);
    if (!ctx) return unauthorized();

    const { id } = await params;
    if (!(await isBrandMember(ctx.userId, id))) return notFound("Brand");

    const runs = await listRunsForBrand(id);
    return NextResponse.json({ scans: runs.map(serializeScan) });
  } catch (err) {
    console.error("GET /api/v1/brands/[id]/scans", err);
    return serverError();
  }
}

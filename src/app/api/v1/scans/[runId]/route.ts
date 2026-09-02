import { NextResponse } from "next/server";

import { getRunById, isBrandMember } from "@/lib/ai-search";
import { requireApiKey } from "@/lib/api-keys/auth";
import { notFound, serverError, unauthorized } from "@/lib/api/respond";
import { serializeScan } from "@/lib/api/serialize";

/** GET /api/v1/scans/{runId} → one scan run the account owns. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const ctx = await requireApiKey(request);
    if (!ctx) return unauthorized();

    const { runId } = await params;
    const run = await getRunById(runId);
    // 404 for both "no such run" and "not yours" — never leak another account's run.
    if (!run || !(await isBrandMember(ctx.userId, run.brand_id))) return notFound("Scan");

    return NextResponse.json({ scan: serializeScan(run) });
  } catch (err) {
    console.error("GET /api/v1/scans/[runId]", err);
    return serverError();
  }
}

import { NextResponse } from "next/server";

import { assertBrandMember, getRunById } from "@/lib/ai-search";
import { notFound } from "@/lib/api/respond";
import { isUuid, withApiKey } from "@/lib/api/route";
import { serializeScan } from "@/lib/api/serialize";

/** GET /api/v1/scans/{runId} → one scan run the account owns. */
export const GET = withApiKey(
  async (auth, { params }: { params: Promise<{ runId: string }> }) => {
    const { runId } = await params;
    if (!isUuid(runId)) return notFound("Scan");

    const run = await getRunById(runId);
    // 404 for "no such run" and "not yours" alike — never leak another account's run.
    if (!run || !(await assertBrandMember(auth.userId, run.brand_id))) return notFound("Scan");

    return NextResponse.json({ scan: serializeScan(run) });
  },
);

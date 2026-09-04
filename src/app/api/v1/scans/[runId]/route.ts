import { NextResponse } from "next/server";

import { serviceError } from "@/lib/api/respond";
import { withApiKey } from "@/lib/api/route";
import { serializeScan } from "@/lib/api/serialize";
import { getScanForUser } from "@/lib/api/services";

/** GET /api/v1/scans/{runId} → one scan run the account owns. */
export const GET = withApiKey(
  async (auth, { params }: { params: Promise<{ runId: string }> }) => {
    const { runId } = await params;
    const result = await getScanForUser(auth.userId, runId);
    if (!result.ok) return serviceError(result.error);
    return NextResponse.json({ scan: serializeScan(result.data.scan) });
  },
);

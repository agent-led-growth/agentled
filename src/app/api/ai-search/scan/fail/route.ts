import { NextResponse } from "next/server";

import { isInternalRequest } from "@/lib/internal-auth";
import { getBrandById, markScanFailed } from "@/lib/laurel";

/**
 * Internal: record a terminal scan failure. The scan-consumer worker calls this
 * on a job's final delivery attempt (after /scan/execute kept crashing), so a
 * brand that never lands is marked failed instead of retried forever. Guarded by
 * INTERNAL_SECRET; never overwrites a completed scan.
 */
export async function POST(request: Request) {
  if (!isInternalRequest(request)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const { brandId } = (await request.json().catch(() => ({}))) as { brandId?: string };
  if (!brandId) return NextResponse.json({ error: "Missing brandId." }, { status: 400 });

  const brand = await getBrandById(brandId);
  if (brand && !brand.first_scan_completed_at) {
    console.warn("scan/fail: recording terminal failure", brandId);
    await markScanFailed(brandId);
  }
  return NextResponse.json({ ok: true });
}

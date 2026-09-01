import { NextResponse } from "next/server";

import { claimScan, getBrandById, getUserIdByAuthId, releaseScan } from "@/lib/ai-search";
import { enqueueScan } from "@/lib/scan-queue";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Enqueues the brand's one-time scan. Membership-guarded and idempotent — a
 * brand with a completed first scan is a no-op. After claiming the lock it sends
 * a job to the scan queue; the scan-consumer worker runs it durably, out of band
 * from this request, so the scan survives the user closing the tab and a failed
 * run is retried + recorded rather than lost. The client polls /metrics.
 */
export async function POST(request: Request) {
  const { brandId } = (await request.json().catch(() => ({}))) as { brandId?: string };
  if (!brandId) return NextResponse.json({ error: "Missing brandId." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const userId = await getUserIdByAuthId(user.id);
  if (!userId) return NextResponse.json({ error: "No profile." }, { status: 403 });

  // Only a member of this brand may run its scan (admin writes bypass RLS).
  const admin = createAdminClient();
  const { data: member } = await admin
    .from("brand_users")
    .select("brand_id")
    .eq("brand_id", brandId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Not your brand." }, { status: 403 });

  const brand = await getBrandById(brandId);
  if (!brand) return NextResponse.json({ error: "Brand not found." }, { status: 404 });
  if (brand.first_scan_completed_at) {
    return NextResponse.json({ ok: true, status: "already-scanned" });
  }

  // In-progress lock: only one run per brand at a time (atomic — see claimScan).
  // A claim also clears any prior failure, so this doubles as the retry; the
  // returned token identifies this run so a duplicate delivery can no-op.
  const runToken = await claimScan(brandId);
  if (!runToken) {
    return NextResponse.json({ ok: true, status: "already-running" });
  }

  // Hand the run to the durable queue; the scan-consumer worker executes it via
  // the internal /scan/execute route, with retries + dead-letter.
  try {
    await enqueueScan({ brandId, triggerEmail: user.email ?? null, runToken });
  } catch (err) {
    // Enqueue failed after the claim — release the lock so it isn't orphaned.
    console.error("scan/run: enqueue failed", brandId, err);
    await releaseScan(brandId);
    return NextResponse.json({ error: "Could not queue the scan." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status: "queued" });
}

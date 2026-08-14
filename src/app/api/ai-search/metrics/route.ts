import { NextResponse } from "next/server";

import {
  getBrandById,
  getBrandMetrics,
  getUserIdByAuthId,
  SCAN_STALE_MS,
} from "@/lib/laurel";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Dashboard data for one brand: the scan status (so the client can show the
 * pre-scan / running / scanned states) and, once scanned, the aggregated
 * metrics. Membership-guarded.
 */
export async function GET(request: Request) {
  const brandId = new URL(request.url).searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "Missing brand." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const userId = await getUserIdByAuthId(user.id);
  if (!userId) return NextResponse.json({ error: "No profile." }, { status: 403 });

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

  const scannedAt = brand.first_scan_completed_at;
  const failed = !scannedAt && brand.scan_failed_at != null;
  const scanning =
    !scannedAt &&
    !failed &&
    brand.scan_started_at != null &&
    Date.now() - new Date(brand.scan_started_at).getTime() < SCAN_STALE_MS;
  // Trend window (the dashboard date filter); default 7 days.
  const rangeDays: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
  const days = rangeDays[new URL(request.url).searchParams.get("range") ?? "7d"] ?? 7;
  const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString();

  const metrics = scannedAt ? await getBrandMetrics(brandId, sinceIso) : null;
  return NextResponse.json({ scannedAt, scanning, failed, metrics });
}

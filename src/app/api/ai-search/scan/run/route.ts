import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

import {
  claimScan,
  generatePrompts,
  getBrandById,
  getUserIdByAuthId,
  insertPrompts,
  listPrompts,
  listSelectedTopics,
  runScan,
  type Brand,
} from "@/lib/laurel";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Kicks off the brand's one-time scan: generate prompts from the selected topics
 * if they don't exist yet, then search + extract + store across all active
 * prompts. Membership-guarded and idempotent — a brand with a completed first
 * scan is a no-op. The scan (~2 min for 9 prompts) runs detached via
 * ctx.waitUntil so it survives the user closing the tab; this handler returns as
 * soon as the run is claimed, and the client polls /metrics for completion.
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
  // Grab the execution context before claiming the lock: if it's unavailable,
  // fail here rather than after claimScan, so we never leave the brand locked
  // for 15 minutes with no scan actually running.
  const { ctx } = getCloudflareContext();

  // In-progress lock: only one run per brand at a time (atomic — see claimScan).
  if (!(await claimScan(brandId))) {
    return NextResponse.json({ ok: true, status: "already-running" });
  }

  // Run the scan off the request so it isn't tied to the browser tab: waitUntil
  // keeps the worker alive until the job settles, independent of the client
  // connection. Errors can't return to the client from here, so the job logs
  // them; per-prompt failures are recorded on their scan rows, and a run where
  // nothing lands leaves first_scan_completed_at null so the 15-min lock lets it
  // retry later.
  ctx.waitUntil(runScanJob(brand));
  return NextResponse.json({ ok: true, status: "started" });
}

/** The detached scan job: generate prompts if none exist yet, then run the scan. */
async function runScanJob(brand: Brand): Promise<void> {
  try {
    const existing = (await listPrompts(brand.id)).filter((p) => p.active);
    if (existing.length === 0) {
      const topics = (await listSelectedTopics(brand.id)).map((t) => ({
        id: t.id,
        label: t.label,
      }));
      const generated = await generatePrompts(
        { name: brand.name, description: brand.description, domain: brand.domain },
        topics,
      );
      if (generated.length > 0) await insertPrompts(brand.id, generated);
    }
    await runScan(brand.id);
  } catch (err) {
    console.error("scan/run: job failed", brand.id, err);
  }
}

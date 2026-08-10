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
} from "@/lib/laurel";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Runs the brand's one-time scan: generate prompts from the selected topics if
 * they don't exist yet, then search + extract + store across all active prompts.
 * Membership-guarded and idempotent — a brand with a completed first scan is a
 * no-op. Synchronous (the free scan is 9 prompts run concurrently); the client
 * shows a "running your scan" state while this resolves.
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
  if (!(await claimScan(brandId))) {
    return NextResponse.json({ ok: true, status: "already-running" });
  }

  try {
    // Generate prompts from the selected topics if none exist yet (pipeline step 5).
    const existing = (await listPrompts(brandId)).filter((p) => p.active);
    if (existing.length === 0) {
      const topics = (await listSelectedTopics(brandId)).map((t) => ({
        id: t.id,
        label: t.label,
      }));
      const generated = await generatePrompts(
        { name: brand.name, description: brand.description, domain: brand.domain },
        topics,
      );
      if (generated.length > 0) await insertPrompts(brandId, generated);
    }

    const result = await runScan(brandId);
    return NextResponse.json({ ok: true, status: "complete", result });
  } catch (err) {
    console.error("scan/run: failed", err);
    return NextResponse.json(
      { error: "Scan could not complete. Please try again." },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { sendScanReadyEmail } from "@/lib/email/scan-ready";
import {
  deleteBrandScans,
  generatePrompts,
  getBrandById,
  insertPrompts,
  listPrompts,
  listSelectedTopics,
  markScanFailed,
  runScan,
} from "@/lib/laurel";

/**
 * Internal scan executor — the durable job body. Called ONLY by the scan-consumer
 * worker (server-to-server, guarded by INTERNAL_SECRET), never by a browser. Runs
 * the scan synchronously: clear any partial rows, generate prompts if needed,
 * search + extract + store, then email whoever triggered it. Records a terminal
 * failure (markScanFailed) when the run lands nothing. Returns 200 on a decided
 * outcome (success or recorded-failure) so the queue acks; 500 only on an
 * unexpected crash, which the queue retries.
 */
export async function POST(request: Request) {
  if (request.headers.get("x-internal-secret") !== env.internalSecret()) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const { brandId, triggerEmail } = (await request.json().catch(() => ({}))) as {
    brandId?: string;
    triggerEmail?: string | null;
  };
  if (!brandId) return NextResponse.json({ error: "Missing brandId." }, { status: 400 });

  const brand = await getBrandById(brandId);
  if (!brand) return NextResponse.json({ error: "Brand not found." }, { status: 404 });
  if (brand.first_scan_completed_at) {
    return NextResponse.json({ ok: true, status: "already-scanned" });
  }

  try {
    // Fresh slate each attempt — the queue may retry, and runScan writes rows
    // only at the end, so clearing partials keeps a re-run from duplicating.
    await deleteBrandScans(brandId);

    // Generate prompts from the selected topics if none exist yet.
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
    if (!result.skipped && result.scanned > 0) {
      if (triggerEmail) {
        await sendScanReadyEmail(triggerEmail, brand.name?.trim() || brand.domain);
      }
      return NextResponse.json({ ok: true, status: "complete", result });
    }

    // Ran but nothing landed (every prompt failed) — terminal, and recorded.
    console.error("scan/execute: no results, marking failed", brandId, result);
    await markScanFailed(brandId);
    return NextResponse.json({ ok: true, status: "failed" });
  } catch (err) {
    // Unexpected crash — let the queue retry; its final attempt records failure.
    console.error("scan/execute: crashed", brandId, err);
    return NextResponse.json({ error: "Scan crashed." }, { status: 500 });
  }
}

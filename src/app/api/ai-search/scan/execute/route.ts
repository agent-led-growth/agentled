import { NextResponse } from "next/server";

import { sendScanReadyEmail } from "@/lib/email/scan-ready";
import { isInternalRequest } from "@/lib/internal-auth";
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
  if (!isInternalRequest(request)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const { brandId, triggerEmail, runToken } = (await request.json().catch(() => ({}))) as {
    brandId?: string;
    triggerEmail?: string | null;
    runToken?: string;
  };
  if (!brandId) return NextResponse.json({ error: "Missing brandId." }, { status: 400 });

  const brand = await getBrandById(brandId);
  if (!brand) return NextResponse.json({ error: "Brand not found." }, { status: 404 });
  if (brand.first_scan_completed_at) {
    return NextResponse.json({ ok: true, status: "already-scanned" });
  }
  // Run-token guard: only the run matching the current claim proceeds; a
  // superseded or duplicate delivery (e.g. a queue redelivery) no-ops safely.
  // Compare as instants, not strings — the token is a JS ISO ("…Z") while the DB
  // serializes scan_started_at with a "+00:00" offset, so `!==` is always true.
  const startedMs = brand.scan_started_at ? new Date(brand.scan_started_at).getTime() : NaN;
  if (runToken && startedMs !== new Date(runToken).getTime()) {
    return NextResponse.json({ ok: true, status: "superseded" });
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
    console.warn("scan/execute: no results, marking failed", brandId, result);
    await markScanFailed(brandId);
    return NextResponse.json({ ok: true, status: "failed" });
  } catch (err) {
    // Unexpected crash — let the queue retry; its final attempt records failure.
    console.error("scan/execute: crashed", brandId, err);
    return NextResponse.json({ error: "Scan crashed." }, { status: 500 });
  }
}

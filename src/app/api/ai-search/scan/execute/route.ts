import { NextResponse } from "next/server";

import { sendScanReadyEmail } from "@/lib/email/scan-ready";
import { isInternalRequest } from "@/lib/internal-auth";
import {
  completeRun,
  createRun,
  deleteBrandScans,
  failRun,
  generatePrompts,
  getBrandById,
  getBrandOwnerId,
  getPlanForUserId,
  insertPrompts,
  listPrompts,
  listSelectedTopics,
  markScanFailed,
  reapStaleRuns,
  runScan,
  startRun,
} from "@/lib/laurel";
import { promptLimit } from "@/lib/plan";

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

  // Free a run stuck by a dead worker before claiming — otherwise its one-in-flight
  // lock would block this brand forever. Then open a run (idempotent: null when a
  // run is already in flight, e.g. a queue redelivery mid-run → no-op).
  await reapStaleRuns(brandId);
  const ownerId = await getBrandOwnerId(brandId);
  const run = await createRun(brandId, ownerId, "onboarding");
  if (!run) return NextResponse.json({ ok: true, status: "in-progress" });

  try {
    await startRun(run.id);

    // Fresh slate each attempt — the queue may retry, and runScan writes rows
    // only at the end, so clearing partials keeps a re-run from duplicating.
    // (Slice 3 scopes this to the run once recurring history accumulates.)
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

    // Scan up to the owner's plan prompt limit (free 9, pro 50, business 150),
    // not a hardcoded 9.
    const plan = ownerId ? await getPlanForUserId(ownerId) : "free";
    const result = await runScan(brandId, run.id, promptLimit(plan));
    if (!result.skipped && result.scanned > 0) {
      await completeRun(run.id, brandId, {
        model: result.model,
        promptsAttempted: result.scanned + result.failed,
        promptsCompleted: result.scanned,
      });
      if (triggerEmail) {
        await sendScanReadyEmail(triggerEmail, brand.name?.trim() || brand.domain);
      }
      return NextResponse.json({ ok: true, status: "complete", result });
    }

    if (result.skipped) {
      // Nothing to scan (no prompts) — a completed-empty run, not a failure; the
      // brand is already marked scanned by runScan, so keep the two consistent.
      await completeRun(run.id, brandId, { model: null, promptsAttempted: 0, promptsCompleted: 0 });
      return NextResponse.json({ ok: true, status: "empty" });
    }

    // Ran but every prompt failed — a genuine, retryable failure.
    console.warn("scan/execute: no results, marking failed", brandId, result);
    await failRun(run.id, "no results landed");
    await markScanFailed(brandId);
    return NextResponse.json({ ok: true, status: "failed" });
  } catch (err) {
    // Unexpected crash — record it on the run and let the queue retry.
    await failRun(run.id, err instanceof Error ? err.message : String(err)).catch(() => {});
    console.error("scan/execute: crashed", brandId, err);
    return NextResponse.json({ error: "Scan crashed." }, { status: 500 });
  }
}

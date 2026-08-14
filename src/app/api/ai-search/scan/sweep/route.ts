import { NextResponse } from "next/server";

import { isInternalRequest } from "@/lib/internal-auth";
import { listDueBrands } from "@/lib/laurel";
import { isDaily } from "@/lib/plan";
import { enqueueScan } from "@/lib/scan-queue";

/** A brand is due again once its last completed run is older than this. */
const DUE_AFTER_MS = 24 * 60 * 60 * 1000;
/** Safety valve — never enqueue more than this in one tick. */
const MAX_PER_TICK = 500;

/**
 * The daily sweep — called ONLY by the scan-cron worker (server-to-server,
 * INTERNAL_SECRET), hourly. Selects active brand rows whose last completed run is
 * over ~24h old (or never) and that have no in-flight run, keeps the ones on a
 * daily (paid) plan, and enqueues a `scheduled` scan for each. The existing
 * consumer drains the queue brand by brand; the executor is idempotent
 * (createRun one-in-flight), so a duplicate enqueue is a harmless no-op.
 *
 * Free brands are never scheduled — they keep the one-time onboarding scan.
 */
export async function POST(request: Request) {
  if (!isInternalRequest(request)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const staleBefore = new Date(Date.now() - DUE_AFTER_MS).toISOString();
  const candidates = await listDueBrands(staleBefore);
  // The daily/free decision lives in code, fail-closed — never in the SQL.
  const due = candidates.filter((c) => isDaily(c.plan)).slice(0, MAX_PER_TICK);

  let enqueued = 0;
  for (const c of due) {
    try {
      await enqueueScan({ brandId: c.brandId, trigger: "scheduled" });
      enqueued += 1;
    } catch (err) {
      console.error("scan/sweep: enqueue failed", c.brandId, err);
    }
  }

  return NextResponse.json({ ok: true, candidates: candidates.length, enqueued });
}

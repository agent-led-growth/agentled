import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import type { ScanRun, ScanRunTrigger } from "./types";

/**
 * scan_runs data access — the durable record of each scan (0012). Server-only,
 * service-role (RLS is the backstop). The state machine is
 * pending -> running -> completed | failed; a terminal run is never mutated.
 *
 * The DB's partial unique index (one non-terminal run per brand) makes claiming a
 * run idempotent: {@link createRun} returns null when one is already in flight,
 * so the daily sweep can never start two concurrent runs for the same brand row.
 */

/** Postgres unique_violation SQLSTATE. */
const UNIQUE_VIOLATION = "23505";
/** How long a run may sit non-terminal before it's treated as dead (worker died). */
export const STALE_RUN_MS = 30 * 60 * 1000;

/** True when a pending/running run already exists for this brand. */
export async function hasInFlightRun(brandId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("scan_runs")
    .select("id")
    .eq("brand_id", brandId)
    .in("status", ["pending", "running"])
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data != null;
}

/** Whether an error is the one-in-flight-run conflict (by SQLSTATE or index name). */
function isInFlightConflict(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return (
    e?.code === UNIQUE_VIOLATION ||
    (typeof e?.message === "string" && e.message.includes("scan_runs_one_inflight"))
  );
}

/**
 * Claim a pending run for a brand row. Returns null if one is already in flight —
 * the idempotency guard, not an error. The read pre-check is the common path (so
 * it never depends on the DB error code); the partial unique index is the hard
 * backstop for a concurrent race, detected by SQLSTATE or the index name.
 */
export async function createRun(
  brandId: string,
  userId: string | null,
  trigger: ScanRunTrigger,
): Promise<ScanRun | null> {
  if (await hasInFlightRun(brandId)) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("scan_runs")
    .insert({ brand_id: brandId, user_id: userId, trigger, status: "pending" })
    .select("*")
    .single();
  if (error) {
    if (isInFlightConflict(error)) return null;
    throw error;
  }
  return data as ScanRun;
}

/**
 * Fail any run for this brand stuck pending/running past STALE_RUN_MS. A worker
 * that died mid-scan would otherwise hold the one-in-flight lock forever and
 * block every future run for the brand. Call before claiming a new run.
 */
export async function reapStaleRuns(brandId: string): Promise<void> {
  const admin = createAdminClient();
  const staleBefore = new Date(Date.now() - STALE_RUN_MS).toISOString();
  const { error } = await admin
    .from("scan_runs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error: "stale: no completion within timeout",
    })
    .eq("brand_id", brandId)
    .in("status", ["pending", "running"])
    .lt("created_at", staleBefore);
  if (error) throw error;
}

/** pending -> running. Guarded so it only advances a still-pending run. */
export async function startRun(runId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("scan_runs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", runId)
    .eq("status", "pending");
  if (error) throw error;
}

/**
 * running -> completed, recording what the run did, and stamp brands.last_scan_at
 * — the anchor the daily-sweep due check reads. Only a completed run advances it.
 */
export async function completeRun(
  runId: string,
  brandId: string,
  fields: {
    model?: string | null;
    promptsAttempted: number;
    promptsCompleted: number;
    costUsd?: number | null;
    tokens?: number | null;
  },
): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("scan_runs")
    .update({
      status: "completed",
      completed_at: now,
      model: fields.model ?? null,
      prompts_attempted: fields.promptsAttempted,
      prompts_completed: fields.promptsCompleted,
      cost_usd: fields.costUsd ?? null,
      tokens: fields.tokens ?? null,
    })
    .eq("id", runId)
    // Only a running run terminalises — never un-fail a run reaped as stale.
    .eq("status", "running");
  if (error) throw error;

  // Best-effort denormalised convenience. The due check reads the last COMPLETED
  // run from scan_runs (the source of truth), so a missed stamp here never causes
  // a re-scan — the run is already completed above.
  const { error: brandErr } = await admin
    .from("brands")
    .update({ last_scan_at: now })
    .eq("id", brandId);
  if (brandErr) console.error("completeRun: last_scan_at stamp failed", brandId, brandErr);
}

/** running -> failed. Retryable; does NOT advance last_scan_at, so the sweep re-picks it. */
export async function failRun(runId: string, errorText: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("scan_runs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error: errorText.slice(0, 1000),
    })
    .eq("id", runId)
    // Only a running run fails here; a run already reaped stale stays as-is.
    .eq("status", "running");
  if (error) throw error;
}

/** The brand's most recent completed run — the trend baseline and due anchor. */
export async function getLastCompletedRun(brandId: string): Promise<ScanRun | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("scan_runs")
    .select("*")
    .eq("brand_id", brandId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ScanRun | null) ?? null;
}

/**
 * Brands due for a scheduled scan (via the 0013 SQL function): active, no
 * in-flight run, and no completed run since `staleBefore`. Returns the owner's
 * raw plan so the caller filters by `isDaily` — the daily/free decision stays in
 * code (fail-closed), never in SQL.
 */
export async function listDueBrands(
  staleBefore: string,
): Promise<{ brandId: string; plan: string | null }[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("due_brands_for_scan", { stale_before: staleBefore });
  if (error) throw error;
  return ((data ?? []) as { brand_id: string; plan: string | null }[]).map((r) => ({
    brandId: r.brand_id,
    plan: r.plan,
  }));
}

/** A brand's runs, newest first — the history the dashboard trends read. */
export async function listRunsForBrand(brandId: string, limit = 90): Promise<ScanRun[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("scan_runs")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ScanRun[];
}

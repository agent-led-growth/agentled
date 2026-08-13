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

/** Postgres unique_violation — an in-flight run already exists for this brand. */
const UNIQUE_VIOLATION = "23505";

/**
 * Claim a pending run for a brand row. Returns null if one is already
 * pending/running (the partial unique index rejects the insert) — that's the
 * idempotency guard, not an error.
 */
export async function createRun(
  brandId: string,
  userId: string | null,
  trigger: ScanRunTrigger,
): Promise<ScanRun | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("scan_runs")
    .insert({ brand_id: brandId, user_id: userId, trigger, status: "pending" })
    .select("*")
    .single();
  if (error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) return null;
    throw error;
  }
  return data as ScanRun;
}

/** pending -> running. */
export async function startRun(runId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("scan_runs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", runId);
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
    .eq("id", runId);
  if (error) throw error;

  const { error: brandErr } = await admin
    .from("brands")
    .update({ last_scan_at: now })
    .eq("id", brandId);
  if (brandErr) throw brandErr;
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
    .eq("id", runId);
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

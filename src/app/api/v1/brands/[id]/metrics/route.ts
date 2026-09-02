import { NextResponse } from "next/server";

import { getBrandMetrics, isBrandMember } from "@/lib/ai-search";
import { requireApiKey } from "@/lib/api-keys/auth";
import { notFound, serverError, unauthorized } from "@/lib/api/respond";

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

/**
 * GET /api/v1/brands/{id}/metrics?days=30 → the brand's AI-visibility metrics
 * over a trailing window. `days` is clamped to 1..365 (default 30).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireApiKey(request);
    if (!ctx) return unauthorized();

    const { id } = await params;
    if (!(await isBrandMember(ctx.userId, id))) return notFound("Brand");

    const raw = Number(new URL(request.url).searchParams.get("days"));
    const days = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), MAX_DAYS) : DEFAULT_DAYS;
    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const metrics = await getBrandMetrics(id, sinceIso);
    return NextResponse.json({ days, metrics });
  } catch (err) {
    console.error("GET /api/v1/brands/[id]/metrics", err);
    return serverError();
  }
}

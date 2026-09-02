import { NextResponse } from "next/server";

import { assertBrandMember, getBrandMetrics } from "@/lib/ai-search";
import { notFound } from "@/lib/api/respond";
import { isUuid, withApiKey } from "@/lib/api/route";

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

/**
 * GET /api/v1/brands/{id}/metrics?days=30 → the brand's AI-visibility metrics
 * over a trailing window. `days` defaults to 30 when absent/invalid, and is
 * clamped to 1..365 otherwise.
 */
export const GET = withApiKey(
  async (auth, { params }: { params: Promise<{ id: string }> }, request) => {
    const { id } = await params;
    if (!isUuid(id)) return notFound("Brand");
    if (!(await assertBrandMember(auth.userId, id))) return notFound("Brand");

    const param = new URL(request.url).searchParams.get("days");
    const parsed = Number(param);
    // `param &&` first, so an absent/empty `days` takes the default rather than
    // Number(null)===0 sliding through Number.isFinite and clamping to 1.
    const days =
      param && Number.isFinite(parsed)
        ? Math.min(Math.max(Math.trunc(parsed), 1), MAX_DAYS)
        : DEFAULT_DAYS;
    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const metrics = await getBrandMetrics(id, sinceIso);
    return NextResponse.json({ days, metrics });
  },
);

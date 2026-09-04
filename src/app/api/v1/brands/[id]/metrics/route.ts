import { NextResponse } from "next/server";

import { serviceError } from "@/lib/api/respond";
import { withApiKey } from "@/lib/api/route";
import { getMetricsForBrand } from "@/lib/api/services";

/**
 * GET /api/v1/brands/{id}/metrics?days=30 → the brand's AI-visibility metrics
 * over a trailing window. `days` defaults to 30 when absent/invalid, and is
 * clamped to 1..365 otherwise. Logic lives in `getMetricsForBrand`.
 */
export const GET = withApiKey(
  async (auth, { params }: { params: Promise<{ id: string }> }, request) => {
    const { id } = await params;
    const days = new URL(request.url).searchParams.get("days");
    const result = await getMetricsForBrand(auth.userId, id, days);
    if (!result.ok) return serviceError(result.error);
    return NextResponse.json({ days: result.data.days, metrics: result.data.metrics });
  },
);

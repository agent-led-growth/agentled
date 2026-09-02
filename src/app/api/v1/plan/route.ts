import { NextResponse } from "next/server";

import { getPlanForUserId } from "@/lib/ai-search";
import { requireApiKey } from "@/lib/api-keys/auth";
import { serverError, unauthorized } from "@/lib/api/respond";
import { planFeatures } from "@/lib/plan";

/** GET /api/v1/plan → the account's plan and its limits. */
export async function GET(request: Request) {
  try {
    const ctx = await requireApiKey(request);
    if (!ctx) return unauthorized();

    const plan = await getPlanForUserId(ctx.userId);
    return NextResponse.json({ plan, features: planFeatures(plan) });
  } catch (err) {
    console.error("GET /api/v1/plan", err);
    return serverError();
  }
}

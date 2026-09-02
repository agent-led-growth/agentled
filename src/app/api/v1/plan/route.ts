import { NextResponse } from "next/server";

import { getPlanForUserId } from "@/lib/ai-search";
import { withApiKey } from "@/lib/api/route";
import { planFeatures } from "@/lib/plan";

/** GET /api/v1/plan → the account's plan and its limits. */
export const GET = withApiKey(async (auth) => {
  const plan = await getPlanForUserId(auth.userId);
  return NextResponse.json({ plan, features: planFeatures(plan) });
});

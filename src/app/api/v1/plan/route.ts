import { NextResponse } from "next/server";

import { withApiKey } from "@/lib/api/route";
import { planSummary } from "@/lib/api/services";

/** GET /api/v1/plan → the account's plan and its limits. */
export const GET = withApiKey(async (auth) => {
  return NextResponse.json(await planSummary(auth.userId));
});

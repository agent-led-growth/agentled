import { NextResponse } from "next/server";

import { getBrandsForUser, getPlanForAuthUser } from "@/lib/laurel";
import { createClient } from "@/lib/supabase/server";

/**
 * The current account's brands (newest first) and plan — powers the dashboard
 * header switcher, the "+ New brand" flow and the plan-aware cadence/upgrade
 * CTAs. Empty + `free` for signed-out visitors.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ brands: [], plan: "free" });

  const [brands, plan] = await Promise.all([
    getBrandsForUser(user.id),
    getPlanForAuthUser(user.id),
  ]);
  return NextResponse.json({
    brands: brands.map((b) => ({ id: b.id, domain: b.domain, name: b.name })),
    plan,
  });
}

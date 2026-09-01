import { NextResponse } from "next/server";

import { getBrandsForUser, getPlanForAuthUser } from "@/lib/ai-search";
import { createClient } from "@/lib/supabase/server";

/**
 * The current account's brands (newest first), plan and email — powers the
 * dashboard header switcher, the "+ New brand" flow, the plan-aware cadence/upgrade
 * CTAs and the Account view. Empty + `free` for signed-out visitors.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ brands: [], plan: "free", email: null });

  // The app-owned email + billing flag (own-row RLS via the request-scoped
  // client), falling back to the auth email if the profile row is somehow missing.
  const [brands, plan, profile] = await Promise.all([
    getBrandsForUser(user.id),
    getPlanForAuthUser(user.id),
    supabase
      .from("users")
      .select("email, stripe_customer_id")
      .eq("auth_user_id", user.id)
      .maybeSingle(),
  ]);
  return NextResponse.json({
    brands: brands.map((b) => ({ id: b.id, domain: b.domain, name: b.name })),
    plan,
    email: profile.data?.email ?? user.email ?? null,
    // Whether the account has a Stripe customer — gates the "Manage billing"
    // control, which needs one (a manually-set/legacy plan has none).
    hasBilling: Boolean(profile.data?.stripe_customer_id),
  });
}

import { NextResponse } from "next/server";

import { getUserIdByAuthId, setSelectedTopics } from "@/lib/laurel";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Persist the topic selection for an already signed-in onboarding — e.g. the
 * dashboard's "+ New brand", which skips the OTP gate that normally saves it.
 * No-op for signed-out visitors: their selection is stored when they claim the
 * brand at the gate.
 */
export async function POST(request: Request) {
  const { brandId, topics } = (await request.json().catch(() => ({}))) as {
    brandId?: string;
    topics?: unknown;
  };
  if (!brandId) return NextResponse.json({ ok: false });

  const labels = Array.isArray(topics)
    ? topics
        .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        .map((t) => t.trim().slice(0, 200))
        .slice(0, 50)
    : [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, reason: "not-authed" });

  const userId = await getUserIdByAuthId(user.id);
  if (!userId) return NextResponse.json({ ok: false });

  // Membership guard: setSelectedTopics uses the service role (bypasses RLS), so
  // only let a member of this brand write its topics.
  const admin = createAdminClient();
  const { data: member } = await admin
    .from("brand_users")
    .select("brand_id")
    .eq("brand_id", brandId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) return NextResponse.json({ ok: false, reason: "not-a-member" });

  if (labels.length > 0) await setSelectedTopics(brandId, labels);
  return NextResponse.json({ ok: true });
}

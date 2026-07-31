import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Target of the link in the confirmation email. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const site = env.siteUrl();

  if (!token || !UUID_RE.test(token)) {
    return NextResponse.redirect(`${site}/subscribed?status=invalid`);
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("subscribers")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("token", token)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("confirm: supabase update failed", error);
      return NextResponse.redirect(`${site}/subscribed?status=error`);
    }
    if (!data) {
      return NextResponse.redirect(`${site}/subscribed?status=invalid`);
    }

    return NextResponse.redirect(`${site}/subscribed?status=ok`);
  } catch (err) {
    console.error("confirm: unexpected failure", err);
    return NextResponse.redirect(`${site}/subscribed?status=error`);
  }
}

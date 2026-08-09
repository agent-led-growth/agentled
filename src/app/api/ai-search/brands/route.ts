import { NextResponse } from "next/server";

import { getBrandsForUser } from "@/lib/laurel";
import { createClient } from "@/lib/supabase/server";

/**
 * The current account's brands, newest first — powers the dashboard header
 * switcher and the "+ New brand" flow. Empty for signed-out visitors.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ brands: [] });

  const brands = await getBrandsForUser(user.id);
  return NextResponse.json({
    brands: brands.map((b) => ({ id: b.id, domain: b.domain, name: b.name })),
  });
}

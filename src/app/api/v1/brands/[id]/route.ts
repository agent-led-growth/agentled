import { NextResponse } from "next/server";

import { getBrandById, isBrandMember } from "@/lib/ai-search";
import { requireApiKey } from "@/lib/api-keys/auth";
import { notFound, serverError, unauthorized } from "@/lib/api/respond";
import { serializeBrand } from "@/lib/api/serialize";

/** GET /api/v1/brands/{id} → one brand the account belongs to. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireApiKey(request);
    if (!ctx) return unauthorized();

    const { id } = await params;
    // 404 (not 403) when the account isn't a member — don't reveal that the id exists.
    if (!(await isBrandMember(ctx.userId, id))) return notFound("Brand");

    const brand = await getBrandById(id);
    if (!brand) return notFound("Brand");
    return NextResponse.json({ brand: serializeBrand(brand) });
  } catch (err) {
    console.error("GET /api/v1/brands/[id]", err);
    return serverError();
  }
}

import { NextResponse } from "next/server";

import { getBrandForMember } from "@/lib/ai-search";
import { notFound } from "@/lib/api/respond";
import { isUuid, withApiKey } from "@/lib/api/route";
import { serializeBrand } from "@/lib/api/serialize";

/** GET /api/v1/brands/{id} → one brand the account belongs to. */
export const GET = withApiKey(
  async (auth, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    if (!isUuid(id)) return notFound("Brand");

    const brand = await getBrandForMember(auth.userId, id);
    if (!brand) return notFound("Brand");
    return NextResponse.json({ brand: serializeBrand(brand) });
  },
);

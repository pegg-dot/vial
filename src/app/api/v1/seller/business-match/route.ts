import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSellerPermission } from "@/server/auth/principal";
import { matchSellerBusiness } from "@/server/seller/matching";
const schema = z.object({ name: z.string().max(180).optional(), websiteUrl: z.string().max(500).optional() }).refine((value) => value.name || value.websiteUrl, "A name or website is required");
export async function POST(request: Request) {
  const auth = await requireApiSellerPermission("seller:profile:read");
  if (auth.response) return auth.response;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid business match request" }, { status: 400 });
  return NextResponse.json({ candidates: await matchSellerBusiness(parsed.data) });
}

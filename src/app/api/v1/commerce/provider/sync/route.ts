import { NextResponse } from "next/server";
import { requireApiSellerPermission } from "@/server/auth/principal";
import { getSellerContext } from "@/server/seller/ops";
import { syncProviderAccount } from "@/server/commerce/activation";

export async function POST() {
  const auth = await requireApiSellerPermission("seller:payments:manage");
  if (auth.response) return auth.response;
  const context = await getSellerContext(auth.principal.email);
  if (!context) return NextResponse.json({ error: "Seller context not found" }, { status: 404 });
  try {
    return NextResponse.json(await syncProviderAccount({ sellerId: context.sellerId, actorId: auth.principal.id }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Provider sync failed" }, { status: 400 });
  }
}

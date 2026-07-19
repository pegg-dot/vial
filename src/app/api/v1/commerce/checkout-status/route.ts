import { NextRequest, NextResponse } from "next/server";
import { requireApiPrincipal } from "@/server/auth/principal";
import { getCheckoutStatusForCustomer } from "@/server/commerce/repository";

export async function GET(request: NextRequest) {
  const auth = await requireApiPrincipal({ accountTypes: ["customer"] });
  if (auth.response) return auth.response;
  const attemptId = request.nextUrl.searchParams.get("attemptId")?.trim();
  if (!attemptId) return NextResponse.json({ error: "attemptId is required" }, { status: 400 });
  const status = await getCheckoutStatusForCustomer(attemptId, auth.principal.id);
  return status ? NextResponse.json(status) : NextResponse.json({ error: "Checkout attempt not found" }, { status: 404 });
}

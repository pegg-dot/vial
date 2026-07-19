import { NextRequest, NextResponse } from "next/server";
import { requireApiPrincipal } from "@/server/auth/principal";
import { evaluateCurrentCart } from "@/server/commerce/activation";

export async function POST(request: NextRequest) {
  const auth = await requireApiPrincipal({ accountTypes: ["customer"] });
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    return NextResponse.json(await evaluateCurrentCart({
      customerKey: auth.principal.id,
      customerType: String(body.customerType || "sandbox_customer"),
      jurisdiction: String(body.jurisdiction || "US-SANDBOX"),
      persist: Boolean(body.persist),
      actorId: auth.principal.id,
    }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Activation evaluation failed" }, { status: 400 });
  }
}

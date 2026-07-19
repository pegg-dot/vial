import { NextRequest, NextResponse } from "next/server";
import { requireApiPrincipal } from "@/server/auth/principal";
import { createApprovedCheckout } from "@/server/commerce/orchestrator";

export async function POST(request: NextRequest) {
  const auth = await requireApiPrincipal({ accountTypes: ["customer"] });
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    return NextResponse.json(await createApprovedCheckout({
      customerKey: auth.principal.id,
      customerType: String(body.customerType || "sandbox_customer"),
      email: auth.principal.email,
      address: {
        line1: String(body.address?.line1 || ""),
        city: String(body.address?.city || ""),
        region: String(body.address?.region || "US-SANDBOX"),
        postalCode: String(body.address?.postalCode || ""),
      },
      jurisdiction: String(body.jurisdiction || body.address?.region || "US-SANDBOX"),
      idempotencyKey: String(body.idempotencyKey || crypto.randomUUID()),
      actorId: auth.principal.id,
    }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Approved checkout failed" }, { status: 400 });
  }
}

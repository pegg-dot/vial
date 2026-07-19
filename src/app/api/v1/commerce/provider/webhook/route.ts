import { NextRequest, NextResponse } from "next/server";
import { getEnvironment } from "@/server/config/env";
import { ingestProviderWebhook } from "@/server/commerce/provider-events";

export async function POST(request: NextRequest) {
  try {
    const payload = Buffer.from(await request.arrayBuffer());
    const signature = request.headers.get("stripe-signature") ?? request.headers.get("x-vial-signature") ?? undefined;
    const environment = getEnvironment();
    const secret = environment.VIAL_PAYMENT_PROVIDER === "stripe" ? environment.STRIPE_WEBHOOK_SECRET : process.env.VIAL_MOCK_WEBHOOK_SECRET;
    return NextResponse.json(await ingestProviderWebhook({ payload, signature, secret }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook rejected" }, { status: 400 });
  }
}

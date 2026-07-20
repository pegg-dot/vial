import { NextRequest, NextResponse } from "next/server";
import { requireApiPrincipal } from "@/server/auth/principal";
import { saveSubscription } from "@/server/push/repository";

export async function POST(request: NextRequest) {
  const auth = await requireApiPrincipal();
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const subscription = body?.subscription;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 });
    }
    await saveSubscription(
      auth.principal.id,
      { endpoint: String(subscription.endpoint), keys: { p256dh: String(subscription.keys.p256dh), auth: String(subscription.keys.auth) } },
      String(request.headers.get("user-agent") ?? ""),
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to save subscription" }, { status: 400 });
  }
}

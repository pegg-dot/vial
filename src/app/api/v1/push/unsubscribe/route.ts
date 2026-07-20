import { NextRequest, NextResponse } from "next/server";
import { requireApiPrincipal } from "@/server/auth/principal";
import { removeSubscriptionForUser } from "@/server/push/repository";

export async function POST(request: NextRequest) {
  const auth = await requireApiPrincipal();
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    if (!body?.endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
    await removeSubscriptionForUser(auth.principal.id, String(body.endpoint));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to remove subscription" }, { status: 400 });
  }
}

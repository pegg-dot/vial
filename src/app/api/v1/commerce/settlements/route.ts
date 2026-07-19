import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/server/auth/principal";
import { releaseDueReserves, runV5Settlement } from "@/server/commerce/settlement";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("finance:write");
  if (auth.response) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    if (body.action === "release_reserves") return NextResponse.json(await releaseDueReserves(auth.principal.id));
    return NextResponse.json(await runV5Settlement({ actorId: auth.principal.id, periodStart: body.periodStart, periodEnd: body.periodEnd }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Settlement failed" }, { status: 400 });
  }
}

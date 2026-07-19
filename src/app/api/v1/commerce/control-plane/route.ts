import { NextResponse } from "next/server";
import { requireApiPermission } from "@/server/auth/principal";
import { approvedCommerceDashboard } from "@/server/commerce/activation";

export async function GET() {
  const auth = await requireApiPermission("commerce:read");
  if (auth.response) return auth.response;
  return NextResponse.json(await approvedCommerceDashboard());
}

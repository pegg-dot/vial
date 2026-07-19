import { NextResponse } from "next/server";
import { requireApiPermission } from "@/server/auth/principal";
import { getOperationalDashboard } from "@/server/observability/metrics";

export async function GET() {
  const auth = await requireApiPermission("security:read");
  if (auth.response) return auth.response;
  return NextResponse.json(await getOperationalDashboard(), { headers: { "Cache-Control": "private, no-store" } });
}

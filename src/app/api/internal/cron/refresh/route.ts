import { NextRequest, NextResponse } from "next/server";
import { runIntelligenceSweep } from "@/server/intelligence/scanner";
import { runRefreshSweep } from "@/server/refresh/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const refresh = await runRefreshSweep(20);
  const intelligence = await runIntelligenceSweep("system:cron");
  return NextResponse.json({ refresh, intelligence, completedAt: new Date().toISOString() });
}

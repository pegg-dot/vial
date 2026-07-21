import { NextRequest, NextResponse } from "next/server";
import { runIntelligenceSweep } from "@/server/intelligence/scanner";
import { runRefreshSweep } from "@/server/refresh/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    // Deny in production, but loudly — a silent 401 here is why "live prices never
    // refresh" on a real deploy. Set CRON_SECRET and point a scheduler at this route.
    if (process.env.NODE_ENV === "production") {
      console.warn("[cron/refresh] CRON_SECRET is not set — refresh + intelligence sweeps are DISABLED. Set CRON_SECRET and configure a scheduler (Vercel cron or the docker scheduler service).");
      return false;
    }
    return true;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const refresh = await runRefreshSweep(20);
  const intelligence = await runIntelligenceSweep("system:cron");
  return NextResponse.json({ refresh, intelligence, completedAt: new Date().toISOString() });
}

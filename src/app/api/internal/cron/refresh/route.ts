import { NextRequest, NextResponse } from "next/server";
import { secretMatches } from "@/server/auth/secret-compare";
import { runIntelligenceSweep } from "@/server/intelligence/scanner";
import { getDatabase } from "@/server/db/client";
import { applyRetention } from "@/server/db/retention";
import { reviewCostSignals } from "@/server/observability/cost-signals";

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
  return secretMatches(request.headers.get("authorization"), `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // The refresh sweep moved to /api/internal/cron/provenance, which runs hourly. It sat here
  // claiming 20 jobs once a day, which was invisible while nothing was enrolled and would have
  // starved instantly once every catalogue listing was. What remains here is housekeeping, and
  // none of it wants to run 24 times a day.
  const intelligence = await runIntelligenceSweep("system:cron");
  // Housekeeping runs with the daily sweep. Operational history used to grow forever — one row per
  // collector run, per page view, per reliability pass, none of it ever removed — which turns into
  // read volume the database bills for. applyRetention never throws, so it cannot fail the sweep.
  const db = await getDatabase();
  const retention = await applyRetention(db);
  // Checks whether the expensive paths ran more often than caching should allow. This is the
  // early warning the last quota blowout did not have: the cache breaking is silent, and the only
  // symptom before was the database dying two weeks later.
  const cost = await reviewCostSignals(db).catch(() => []);
  return NextResponse.json({ intelligence, retention, cost, completedAt: new Date().toISOString() });
}

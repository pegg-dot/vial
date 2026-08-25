import { NextRequest, NextResponse } from "next/server";
import { secretMatches } from "@/server/auth/secret-compare";
import { runRefreshSweep } from "@/server/refresh/scheduler";
import { triagePendingClaims } from "@/server/refresh/auto-triage";
import { isLiveIngestApproved } from "@/server/ingest/live-sources";
import { PROVENANCE_SWEEP_JOBS } from "@/server/collect/schedule-capacity";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// The provenance sweep, on its own schedule.
//
// It used to ride along with the daily housekeeping cron, claiming 20 jobs once a day. That was
// invisible while zero listings were enrolled. Now that every catalogue listing is enrolled, a
// daily sweep of 20 could not even serve the 43 listings production had at the time — it would have
// been the collector starvation again, built deliberately, three days after fixing it.
//
// Separate route because the daily cron also runs the intelligence sweep, retention and cost
// signals, and none of those want to run 24 times a day. Offset to :15 so it does not contend with
// the catalogue collectors at :00.
function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[cron/provenance] CRON_SECRET is not set — the provenance sweep is DISABLED.");
      return false;
    }
    return true;
  }
  return secretMatches(request.headers.get("authorization"), `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetching third-party storefronts is an explicit, approved act — never a silent default.
  if (!isLiveIngestApproved()) {
    return NextResponse.json({ skipped: "live ingest not approved", hint: "set VIALGRADE_LIVE_INGEST_APPROVED=true" }, { status: 200 });
  }

  const refresh = await runRefreshSweep(PROVENANCE_SWEEP_JOBS);
  // Triage runs in the same tick as the sweep that produced the claims. Deferring it would leave a
  // queue of page-chrome noise sitting in front of a human between ticks, which is exactly the
  // "unread queue that looks like oversight" this is meant to avoid.
  const triage = await triagePendingClaims();
  return NextResponse.json({
    refresh,
    triage: { approved: triage.approved.length, rejected: triage.rejected.length, held: triage.held.length },
    completedAt: new Date().toISOString(),
  });
}

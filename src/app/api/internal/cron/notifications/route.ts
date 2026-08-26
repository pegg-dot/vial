import { NextRequest, NextResponse } from "next/server";
import { secretMatches } from "@/server/auth/secret-compare";
import { NOTIFICATION_SWEEP_USERS, runNotificationSweep } from "@/server/notifications/sweep";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// The tick that makes "we'll tell you when something changes" true.
//
// Until this existed, notifications were materialized ONLY by a reader loading /for-you or
// /account/notifications. Nothing arrived while they were away, and the web-push path — the one
// channel that could reach someone who was not looking — fired inside that same user-initiated
// loop, so it could only notify a reader who was already on the page.
//
// Daily rather than hourly: the catalogue collectors run hourly and the reviewed changes they
// produce are what this reports on, so a faster tick would mostly re-read a database that has not
// moved.
//
// The TIME matters, and the obvious choice is wrong. A sweep scheduled overnight lands inside the
// default quiet hours (22:00-08:00 America/New_York), and the policy correctly refuses to push
// during them — so an overnight cron would write inbox rows every night and never once buzz a
// phone. Push has no scheduler of its own to hand a deferred notification to, so if the sweep is
// asleep when the reader is, the channel is dead in practice.
//
// 15:30 UTC is 11:30 in New York and 08:30 in Los Angeles: past the default quiet window on both
// US coasts, and off the hour so it does not contend with the collectors at :00 or the provenance
// sweep at :15/:30.
function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[cron/notifications] CRON_SECRET is not set — the notification sweep is DISABLED.");
      return false;
    }
    return true;
  }
  return secretMatches(request.headers.get("authorization"), `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // The budget is well inside maxDuration so the sweep stops itself and writes its receipt rather
  // than being killed mid-user with nothing recorded.
  const result = await runNotificationSweep({ maxUsers: NOTIFICATION_SWEEP_USERS, budgetMs: 90_000 });
  return NextResponse.json({ ...result, completedAt: new Date().toISOString() });
}

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
// Every six hours, and the reason is quiet hours rather than freshness.
//
// Push has no scheduler of its own — this sweep IS the scheduler. So a tick has to land outside a
// reader's quiet window or they are never pushed at all, and no single daily slot can do that for
// everyone: 15:30 UTC clears both US coasts and Europe, and is 23:30 in Shanghai, 00:30 in Tokyo
// and 03:30 in Auckland — permanently inside the default 22:00-08:00 window. Push was dead by
// construction for those readers, with no symptom anywhere.
//
// Four ticks a day gives every timezone one outside its quiet hours, and anything held back by one
// tick is delivered by the next: `user_notifications.pushed_at` records what has actually gone out,
// so deferral is recoverable instead of silently permanent. Offset to :30 so it does not contend
// with the collectors at :00 or the provenance sweep at :15/:45.
//
// Cost: pure SQL plus an in-process search, no model calls, and per-reader work is bounded — four
// cheap ticks beat one that reaches a fraction of the audience.
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

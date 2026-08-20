import { NextRequest, NextResponse } from "next/server";
import { recordPageView } from "@/server/analytics/visitors";
import { isBotUserAgent } from "@/server/analytics/is-bot";
import { isStaffTraffic } from "@/server/analytics/self-traffic";
import { SESSION_COOKIE } from "@/server/auth/session-envelope";

export const dynamic = "force-dynamic";

// Records one page view. No cookies, no account, no IP stored — the visitor hash is salted and
// rotates daily (see server/outbound/attribution.ts).
//
// Deliberately forgiving: a tracking failure must never surface to a reader or block a page, so
// every error returns 204 and is swallowed. Traffic measurement is not worth a broken site.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { path?: string };
    const path = String(body.path ?? "").slice(0, 300);
    // Only record real in-app paths; never a full URL, never anything with a query string.
    if (!path.startsWith("/") || path.includes("://")) return new NextResponse(null, { status: 204 });

    // Drop crawler views BEFORE touching the database rather than storing them with is_bot=true.
    // Every surface that reads page_views already filters `NOT is_bot`, so these rows were written,
    // indexed, retained and scanned without a single query ever returning one — a database write
    // per crawler hit, for data nothing reads. The counting rule is unchanged; only the storage is.
    if (isBotUserAgent(request.headers.get("user-agent"))) return new NextResponse(null, { status: 204 });

    // Our own reading of the live site is not traffic we can quote to a vendor. The staff session
    // cookie the browser already sends is the signal; see server/analytics/self-traffic.ts.
    if (await isStaffTraffic(request.cookies.get(SESSION_COOKIE)?.value)) {
      return new NextResponse(null, { status: 204 });
    }

    await recordPageView({
      path: path.split("?")[0]!,
      referrer: request.headers.get("referer"),
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: request.headers.get("user-agent"),
      selfHost: request.nextUrl.host,
    });
  } catch {
    /* never let analytics break a page view */
  }
  return new NextResponse(null, { status: 204 });
}

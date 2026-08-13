import { NextRequest, NextResponse } from "next/server";
import { recordPageView } from "@/server/analytics/visitors";

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

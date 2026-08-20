import { NextResponse, type NextRequest } from "next/server";
import { resolveAndRecordClick } from "@/server/outbound/clicks";
import { isStaffTraffic } from "@/server/analytics/self-traffic";
import { SESSION_COOKIE } from "@/server/auth/session-envelope";

export const dynamic = "force-dynamic";

// Outbound handoff: /go?l=<listingSlug>. Records the click (demand data) and 302-redirects to the
// vendor's own product page. The destination is resolved server-side from the listing's stored
// external_url — never from the request — so this is not an open redirect. VialGrade never sells or
// touches money; this simply hands the buyer to the vendor, and is the seam where affiliate
// monetization attaches. Unknown/demo/urlless listings fall back to the market.
export async function GET(request: NextRequest) {
  const listingSlug = new URL(request.url).searchParams.get("l");
  const base = new URL(request.url).origin;
  if (!listingSlug) return NextResponse.redirect(`${base}/market`, 302);
  // Our own staff clicks resolve and redirect exactly as before, but are not recorded as demand:
  // the vendor-facing figure is the one number that must never contain us.
  const staff = await isStaffTraffic(request.cookies.get(SESSION_COOKIE)?.value).catch(() => false);
  // Attribution context, recorded privacy-safely: the visitor hash is salted and rotates daily,
  // so it counts distinct people without being able to identify or follow one.
  const resolved = await resolveAndRecordClick(listingSlug, undefined, {
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
    landingPath: request.headers.get("referer"),
    staff,
  }).catch(() => null);
  if (!resolved) return NextResponse.redirect(`${base}/market`, 302);
  return NextResponse.redirect(resolved.destination, 302);
}

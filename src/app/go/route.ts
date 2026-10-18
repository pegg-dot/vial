import { NextResponse } from "next/server";

// Compliance hold: VialGrade is an evidence registry, not a purchase-referral service.
// The historical handoff endpoint remains closed for bookmarked and crafted URLs.
export const dynamic = "force-dynamic";

export async function GET(_request: Request) {
  void _request;
  return NextResponse.json(
    { error: "Purchase referrals are unavailable. VialGrade publishes evidence records only." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}

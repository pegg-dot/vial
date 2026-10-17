import { NextRequest, NextResponse } from "next/server";
import { secretMatches } from "@/server/auth/secret-compare";

export const dynamic = "force-dynamic";

/**
 * Retain the protected Vercel cron endpoint but do not generate, persist
 * or send research-interest alerts while personalized processing is paused.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (!secretMatches(request.headers.get("authorization"), `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(
    { paused: true, reason: "Research notifications under privacy review" },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

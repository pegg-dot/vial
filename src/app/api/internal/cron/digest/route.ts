import { NextRequest, NextResponse } from "next/server";
import { secretMatches } from "@/server/auth/secret-compare";
import { getDatabase } from "@/server/db/client";
import { defaultMailer } from "@/server/digest/subscribers";
import { runDigest } from "@/server/digest/send-digest";
import { fetchPublicTrialIndex } from "@/server/intelligence/public-trials";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Weekly email-only update list. Same CRON_SECRET guard as the other cron routes. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  } else if (!secretMatches(request.headers.get("authorization"), `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runDigest(await getDatabase(), { topics: fetchPublicTrialIndex, mail: defaultMailer() });
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { runVerification } from "@/server/verify";
import { getRequestContext } from "@/server/auth/request-context";
import { consumeRateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

const Schema = z.object({ query: z.string().trim().min(1).max(200) });

// A public, unauthenticated endpoint that makes VialGrade fetch things.
//
// A query for a domain we do not track runs three outbound requests — an RDAP registry lookup, a
// Reddit search, and a COA index check — so every call to this route is up to three calls to
// somebody else, made from our address and paid for with our function time. It shipped with no
// limit of any kind, which made "check a vendor" a request amplifier anyone could point at a
// registry until that registry started refusing us.
//
// The primitive already existed and is what the login and registration paths use; this route just
// never reached for it. Twenty a minute is far above what the page can produce by hand (the form
// is one submit, the examples are four buttons) and far below what a script needs to be a problem.
const RATE = { bucket: "verify-ip", limit: 20, windowSeconds: 60 };

export async function POST(req: Request) {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter something to check." }, { status: 400 });

  const { ipHash } = await getRequestContext();
  const limit = await consumeRateLimit({ ...RATE, key: ipHash });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "That's a lot of checks at once — give it a minute and try again." },
      { status: 429, headers: { "retry-after": String(RATE.windowSeconds) } },
    );
  }

  const result = await runVerification(parsed.data.query);
  return NextResponse.json(result, { headers: { "cache-control": "private, no-store" } });
}

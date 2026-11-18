import { NextRequest, NextResponse } from "next/server";
import { handleSubscribeRequest } from "@/server/digest/subscribe-request";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2048;
const reply = (status: string, code = 200) => NextResponse.json({ status }, { status: code, headers: { "Cache-Control": "private, no-store" } });

/**
 * The email signup endpoint, for the signup page and the first-visit prompt. A route under
 * /intelligence rather than a server action because the prompt renders on pages (compounds,
 * vendors) whose own URL the release gate closes to POST. Same-origin only: the proxy rejects a
 * cross-origin POST before this runs.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return reply("invalid", 413);
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return reply("invalid", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return reply("invalid", 400);
  const { email, consent, company } = body as Record<string, unknown>;
  return reply(await handleSubscribeRequest({ email, consent, company }));
}

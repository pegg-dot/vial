import { NextRequest, NextResponse } from "next/server";
import { handleSubscribeRequest } from "@/server/digest/subscribe-request";
import { readCappedBody } from "@/server/http/capped-body";

export const dynamic = "force-dynamic";

/** An address, a consent flag and the trap field fit in a fraction of this. */
const MAX_SUBSCRIBE_BODY_BYTES = 2048;
const reply = (status: string, code = 200) => NextResponse.json({ status }, { status: code, headers: { "Cache-Control": "private, no-store" } });

/**
 * The email signup endpoint, for the signup page and the first-visit prompt. A route under
 * /intelligence rather than a server action because the prompt renders on pages (compounds,
 * vendors) whose own URL the release gate closes to POST. Same-origin only: the proxy rejects a
 * cross-origin POST before this runs. The per-connection limit is applied inside the handler,
 * after the consent check and before anything is stored.
 */
export async function POST(request: NextRequest) {
  const raw = await readCappedBody(request, MAX_SUBSCRIBE_BODY_BYTES);
  if (raw === null) return reply("invalid", 413);
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return reply("invalid", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return reply("invalid", 400);
  const { email, consent, company } = body as Record<string, unknown>;
  return reply(await handleSubscribeRequest({ email, consent, company }));
}

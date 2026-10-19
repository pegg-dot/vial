/**
 * Explicitly gated, anonymous LOCAL ONLY endpoint. Never enable this path
 * in a public deployment without a real privacy/security/source-rights review.
 *
 * One click = one bounded model analysis run (up to four model steps). No prompt or result persistence,
 * file uploads, external arbitrary URL retrieval, payments or account tracking.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { researchAiRequestSchema, isOutOfScopeResearchQuestion } from "@/lib/research-ai-contract";
import { researchAiAvailability } from "@/server/intelligence/research-ai-config";
import { reserveResearchAiCall } from "@/server/intelligence/research-ai-limiter";
import { runResearchAiAgent } from "@/server/intelligence/research-ai-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = {
  "Cache-Control": "no-store, private, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
function response(message: string, status: number, code: string) {
  return NextResponse.json({ error: message, code }, { status, headers: noStore });
}

/** A real signed, 30-minute local capability, never a hard-coded demo token. */
function hasValidPilotToken(token: string | null): boolean {
  const key = process.env.AI_GATEWAY_API_KEY?.trim();
  if (!key || !token) return false;
  const parts = /^(\d{10})\.([0-9a-f]{24})\.([0-9a-f]{64})$/.exec(token);
  if (!parts) return false;
  const now = Math.floor(Date.now() / 1000);
  const issuedAt = Number(parts[1]);
  if (!Number.isFinite(issuedAt) || issuedAt > now + 30 || now - issuedAt > 1800) return false;
  const payload = parts[1] + "." + parts[2];
  const expected = Buffer.from(
    createHmac("sha256", key).update("vialgrade-ai-local-v1:" + payload).digest("hex"), "hex",
  );
  const actual = Buffer.from(parts[3], "hex");
  return actual.length === expected.length && timingSafeEqual(expected, actual);
}

/** The proxy and handler must agree on local browser Origin despite Next URL normalization. */
function validLocalBrowserOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site") return false;
  try {
    const url = new URL(request.url);
    const given = new URL(origin);
    const loopback = new Set(["127.0.0.1", "localhost"]);
    if (!loopback.has(url.hostname) || !loopback.has(given.hostname)
        || url.protocol !== "http:" || given.protocol !== "http:") return false;
    if (given.origin === url.origin) return true;
    const actualHost = request.headers.get("host")?.toLowerCase();
    return Boolean(actualHost) && given.host.toLowerCase() === actualHost;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  // Gate BEFORE reading the body, making a tool call, or spending credits.
  const availability = researchAiAvailability();
  if (!availability.enabled) {
    return response("The optional localhost AI analyst has not been connected or enabled.", 503, "model_not_connected");
  }

  if (!validLocalBrowserOrigin(request)) {
    return response("The research pilot accepts same-origin local requests only.", 403, "local_origin_required");
  }
  if (!hasValidPilotToken(request.headers.get("x-vialgrade-research-ai-token"))) {
    return response("The local AI research session needs a valid short-lived authorization token.", 401, "local_token_required");
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return response("Expected JSON request.", 415, "invalid_content_type");
  }
  const size = request.headers.get("content-length");
  if (size && (!Number.isFinite(Number(size)) || Number(size) > 2048)) {
    return response("The question is too long.", 413, "request_too_large");
  }

  let parsed: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 2048) return response("The question is too long.", 413, "request_too_large");
    parsed = JSON.parse(raw);
  } catch {
    return response("Invalid JSON.", 400, "invalid_json");
  }
  const candidate = researchAiRequestSchema.safeParse(parsed);
  if (!candidate.success) {
    return response("Choose a listed research question, and confirm external-model processing.", 400, "invalid_question");
  }
  if (isOutOfScopeResearchQuestion(candidate.data.question)) {
    return response("This one-compound evidence assistant cannot provide purchasing, administration, molecule design, manufacturing instructions, or reviews of other compounds.", 422, "outside_evidence_scope");
  }

  const lease = reserveResearchAiCall();
  if (!lease.ok) {
    return response(
      lease.reason === "concurrent" ? "A research analysis is already running." :
        "The local model-call allowance has been reached for this process.",
      429,
      lease.reason,
    );
  }
  try {
    const result = await runResearchAiAgent(candidate.data, { abortSignal: request.signal });
    return NextResponse.json(result, { headers: noStore });
  } catch {
    // Never emit raw provider payloads, private prompts, stack traces or keys.
    return response("The model could not produce a fully source-matched research assessment. No answer was published.", 502, "model_or_citation_failure");
  } finally {
    lease.release();
  }
}

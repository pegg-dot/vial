import { NextRequest, NextResponse } from "next/server";
import { reportError } from "@/server/observability/alerts";

export const dynamic = "force-dynamic";

// Where the browser-side error boundaries report to.
//
// Errors that happen in the client previously died in the visitor's own console, which meant the
// owner could only learn about a broken page from someone telling him. This gives those errors a
// path to the same alerting the server uses.
//
// It is a PUBLIC endpoint, so it is written assuming the caller is hostile:
//   - the body is length-capped before anything is parsed;
//   - only a fixed set of short string fields is read, and each is truncated;
//   - the alert `kind` is a CONSTANT, never taken from the request, so the 15-minute throttle in
//     alerts.ts applies to the whole endpoint. A flood of forged reports collapses into one message
//     per window rather than becoming a notification-spam vector aimed at the owner;
//   - it always answers 204 and never reveals whether an alert was dispatched.
const MAX_BODY_BYTES = 4_000;

export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 204 });

    const body = JSON.parse(raw) as { message?: unknown; path?: unknown; digest?: unknown };
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

    const message = str(body.message, 300);
    if (!message) return new NextResponse(null, { status: 204 });

    reportError({
      kind: "client-error",
      message,
      context: {
        path: str(body.path, 200),
        digest: str(body.digest, 64),
        // The user-agent helps tell a real browser failure from a scripted probe. No IP is stored.
        userAgent: request.headers.get("user-agent")?.slice(0, 200),
      },
    });
  } catch {
    /* a failed error report must never itself become an error */
  }
  return new NextResponse(null, { status: 204 });
}

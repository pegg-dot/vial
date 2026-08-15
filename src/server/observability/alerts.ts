// Telling the owner that something broke, without a monitoring vendor.
//
// The failure this exists to prevent already happened: the site returned a server error on every
// page for hours and nobody knew, because the only record was a console.error in a visitor's own
// browser and a Vercel function log nobody reads. A one-person project needs a push notification,
// not a dashboard it will never open.
//
// So this is deliberately small and dependency-free:
//   1. It always writes a structured single-line JSON record to stderr, which Vercel captures and
//      makes greppable. This costs nothing and works with no configuration at all.
//   2. If VIALGRADE_ALERT_WEBHOOK is set, it also posts a short human-readable message. The payload
//      carries both `content` and `text`, which makes it work as-is with a Discord webhook and a
//      Slack incoming webhook — each reads its own key and ignores the other. Both are free and take
//      about two minutes to create, with no new account.
//
// THE RATE LIMIT IS THE LOAD-BEARING PART. During the outage every request would have alerted, which
// means thousands of messages, which means notifications get muted, which means the next real
// incident is missed. Alerts that cry wolf are worse than no alerts, so identical failures are
// collapsed and each distinct fingerprint can fire at most once per cooldown window.
//
// Nothing here may ever throw or block: monitoring that breaks the thing it monitors is a net loss.

const COOLDOWN_MS = 15 * 60 * 1000; // one message per distinct failure per 15 minutes
const MAX_TRACKED = 200;            // bound the map so a pathological error loop cannot grow it
const lastSent = new Map<string, number>();

export type AlertSeverity = "error" | "critical";

export interface AlertEvent {
  /** Short, stable label for the failure — becomes the dedupe key. Never interpolate an id into it. */
  kind: string;
  /** One line a human can act on. */
  message: string;
  severity?: AlertSeverity;
  /** Anything useful for diagnosis. Never include secrets, tokens, or personal data. */
  context?: Record<string, unknown>;
}

function shouldSend(fingerprint: string, now: number): boolean {
  const previous = lastSent.get(fingerprint);
  if (previous !== undefined && now - previous < COOLDOWN_MS) return false;
  // Cheapest possible eviction: when full, drop the oldest entry. Exactness does not matter here.
  if (lastSent.size >= MAX_TRACKED) {
    const oldest = [...lastSent.entries()].sort((a, b) => a[1] - b[1])[0];
    if (oldest) lastSent.delete(oldest[0]);
  }
  lastSent.set(fingerprint, now);
  return true;
}

/**
 * Record a failure, and notify if a webhook is configured.
 *
 * Fire-and-forget by design — callers must not await it on a request path. Returns whether an
 * alert was actually dispatched, which is what the tests assert against.
 */
export function reportError(event: AlertEvent): boolean {
  try {
    const severity = event.severity ?? "error";
    const now = Date.now();

    // Always log, even when suppressed for alerting, so the record is complete in Vercel's logs.
    console.error(JSON.stringify({
      at: new Date(now).toISOString(),
      level: severity,
      kind: event.kind,
      message: event.message,
      ...(event.context ? { context: event.context } : {}),
    }));

    const webhook = process.env.VIALGRADE_ALERT_WEBHOOK?.trim();
    if (!webhook) return false;
    if (!shouldSend(`${severity}:${event.kind}`, now)) return false;

    const line = `${severity === "critical" ? "🔴" : "⚠️"} VialGrade — ${event.kind}\n${event.message}`;
    // Both keys so one webhook URL works for Discord (`content`) or Slack (`text`).
    void fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: line, text: line }),
    }).catch(() => { /* an alert that fails must stay silent, never escalate */ });

    return true;
  } catch {
    // Monitoring must never take down the thing it monitors.
    return false;
  }
}

/** Test-only: clear the dedupe window so cases do not leak into each other. */
export function __resetAlertThrottleForTests(): void {
  lastSent.clear();
}

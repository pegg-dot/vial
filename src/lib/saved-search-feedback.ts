import type { SavedSearch } from "@/server/consumer-intelligence/types";

/**
 * Pure text and state helpers for the saved-searches surface, extracted so the parts that decide
 * what the reader is told — and which controls stay disabled — can be tested without a browser.
 */

/**
 * A `fetch` that REJECTS never produced a verdict: offline, DNS gone, a server replaced mid-deploy.
 * Nothing was stored, so the reader must be told that rather than left looking at an optimistic
 * value the server never saw.
 */
export const TRANSPORT_FAILURE = "Could not reach VialGrade — nothing was saved. Check your connection and try again.";

/**
 * The server answered and refused. Prefer its own words (they carry the reason — a duplicate name,
 * a missing record) and fall back only when the body carried none or would not parse.
 */
export function serverFailureMessage(payload: unknown, fallback: string): string {
  const error = (payload as { error?: unknown } | null | undefined)?.error;
  return typeof error === "string" && error.trim() ? error.trim() : fallback;
}

/**
 * An alert-mode save that failed leaves the STORED value where it was. The message has to name
 * that value, because the control has just been rolled back under the reader's cursor and the
 * whole point is that what they see now is what the server actually holds.
 */
export function alertModeFailureMessage(message: string, previous: SavedSearch["alertMode"]): string {
  return `${message} — still ${previous}.`;
}

/**
 * Per-row busy flags.
 *
 * These were a single `string | null` slot, which cannot express "A and B are both in flight".
 * Change row A then row B quickly and A's completion wrote `null`, re-enabling B's control while
 * B's request was still open — so a second change could be sent over the first, and the row could
 * report itself idle while it was not. A record keyed by row id has no such crosstalk.
 */
export function withRowFlag(flags: Record<string, boolean>, id: string, busy: boolean): Record<string, boolean> {
  if (busy) return { ...flags, [id]: true };
  if (!(id in flags)) return flags;
  const rest = { ...flags };
  delete rest[id];
  return rest;
}

/** Same shape for per-row messages: set one, clear one, never disturb another row's. */
export function withRowMessage(messages: Record<string, string>, id: string, message: string | null): Record<string, string> {
  if (message !== null) return { ...messages, [id]: message };
  if (!(id in messages)) return messages;
  const rest = { ...messages };
  delete rest[id];
  return rest;
}

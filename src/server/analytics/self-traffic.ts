// Keeping our own browsing out of the numbers we quote to a vendor.
//
// The bot filter catches crawlers and our own scripts, but it cannot catch US: an operator reading
// the live site in a normal browser is indistinguishable from a reader. Every day spent checking
// vialgrade.com added at least one "person" to the 30-day figure, and because the visitor hash
// rotates daily, a month of checking the site reads as a month of strangers.
//
// The signal we already have is the staff session cookie the browser sends with the page-view
// beacon. No new cookie, no fingerprint, no IP allowlist to maintain as networks change.
//
// Fails OPEN by design: any error means we count the view, which is the behaviour we had before.
// A miscounted view is a small honest error; a tracking call that throws would break a page.
import { decodeSessionEnvelope } from "@/server/auth/session-envelope";
import { getPrincipalBySession } from "@/server/auth/repository";
import type { SqlConnection } from "@/server/db/client";

/**
 * True when a request carries a live STAFF session — i.e. it is one of us, not a reader.
 *
 * Deliberately narrow: sellers and labs are outside parties, and excluding them would understate
 * genuine interest. Only our own staff traffic is removed.
 *
 * Costs nothing for an anonymous reader: with no session cookie this returns before any query.
 */
export async function isStaffTraffic(
  sessionCookie: string | undefined | null,
  connection?: SqlConnection,
): Promise<boolean> {
  try {
    const envelope = decodeSessionEnvelope(sessionCookie ?? undefined);
    if (!envelope || envelope.accountType !== "staff") return false;
    const principal = await getPrincipalBySession(envelope.sessionId, connection);
    return Boolean(principal && principal.id === envelope.userId && principal.accountType === "staff");
  } catch {
    return false;
  }
}

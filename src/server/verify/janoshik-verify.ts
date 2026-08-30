// Live re-verification against Janoshik's public test database.
//
// annotateJanoshikListings() takes the current public feed and, for every stored COA that carries a
// Janoshik verify_key, records whether that certificate is STILL publicly listed by the lab, the
// authoritative "Made By" the portal shows, and when we checked. A cert that was listed before and
// is now absent (delisted) is surfaced as a trust change. Honest framing: same source as ingest, so
// this is continued-listing / freshness, not third-party corroboration.
//
// The fetch identifies itself. It used to send a Chrome user-agent string; the portal's Cloudflare
// edge refuses server-side clients regardless (403 "Attention Required" to the Chrome UA, to curl
// and to this honest one alike, probed 2026-08-30), and a citable evidence pipeline does not wear a
// browser's name to get past a door. When the lab's edge admits a server, it admits it as us.

import type { SqlConnection } from "@/server/db/client";
import { parseJanoshikFeed, type JanoshikEntry } from "@/server/ingest/lab-tests";

export const PORTAL_URL = "https://public.janoshik.com/";
const UA = "VialGrade-Catalog-Import/1.0";

/** The portal answered, but not with the feed. Carries the status so the queue can name it. */
export class JanoshikPortalError extends Error {
  constructor(readonly status: number) {
    super(`Janoshik portal returned ${status}`);
    this.name = "JanoshikPortalError";
  }
}

/** Fetch and parse the live Janoshik public feed. Collector-only (live network). Returns the
 *  raw HTML too so the hand script can refresh its on-disk snapshot. `fetchImpl` is injectable so
 *  the collector's refusal path can be exercised without the network. */
export async function fetchJanoshikPortal(options: { fetchImpl?: typeof fetch } = {}): Promise<{ html: string; entries: JanoshikEntry[] }> {
  const doFetch = options.fetchImpl ?? fetch;
  const res = await doFetch(PORTAL_URL, { headers: { "user-agent": UA, accept: "text/html" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new JanoshikPortalError(res.status);
  const html = await res.text();
  return { html, entries: parseJanoshikFeed(html) };
}

export interface JanoshikSyncResult {
  keysChecked: number;
  stillListed: number;
  delisted: string[]; // verify_keys that were previously listed and are now gone
}

/**
 * Re-verify every stored COA against the current public feed. Sets janoshik_listed / made_by /
 * checked_at on each row that has a verify_key. Returns what changed since the last check.
 */
export async function annotateJanoshikListings(db: SqlConnection, entries: JanoshikEntry[]): Promise<JanoshikSyncResult> {
  const live = new Map<string, string>(); // verify_key -> made_by
  for (const e of entries) if (e.verifyKey) live.set(e.verifyKey, e.manufacturer && e.manufacturer !== "Unknown" ? e.manufacturer : "");

  const rows = (await db.query<{ verify_key: string; janoshik_listed: boolean | null }>(
    `SELECT verify_key, janoshik_listed FROM lab_test_records WHERE verify_key IS NOT NULL AND verify_key <> ''`,
  )).rows;

  const delisted: string[] = [];
  let stillListed = 0;
  for (const r of rows) {
    const listed = live.has(r.verify_key);
    if (listed) stillListed++;
    // Flag a cert that we had confirmed present before and is now gone.
    if (!listed && r.janoshik_listed === true) delisted.push(r.verify_key);
    await db.query(
      `UPDATE lab_test_records SET janoshik_listed=$1, janoshik_made_by=COALESCE($2, janoshik_made_by), janoshik_checked_at=NOW() WHERE verify_key=$3`,
      [listed, listed ? (live.get(r.verify_key) || null) : null, r.verify_key],
    );
  }
  return { keysChecked: rows.length, stillListed, delisted };
}

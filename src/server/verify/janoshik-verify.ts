// Live re-verification against Janoshik's public test database.
//
// annotateJanoshikListings() takes the current public feed and, for every stored COA that carries a
// Janoshik verify_key, records whether that certificate is STILL publicly listed by the lab, the
// authoritative "Made By" the portal shows, and when we checked. A cert that was listed before and
// is now absent (delisted) is surfaced as a trust change. Honest framing: same source as ingest, so
// this is continued-listing / freshness, not third-party corroboration.

import type { SqlConnection } from "@/server/db/client";
import { parseJanoshikFeed, type JanoshikEntry } from "@/server/ingest/lab-tests";

const PORTAL_URL = "https://public.janoshik.com/";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

/** Fetch and parse the live Janoshik public feed. Collector-only (live network). */
export async function fetchJanoshikPortal(): Promise<JanoshikEntry[]> {
  const res = await fetch(PORTAL_URL, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Janoshik portal returned ${res.status}`);
  return parseJanoshikFeed(await res.text());
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

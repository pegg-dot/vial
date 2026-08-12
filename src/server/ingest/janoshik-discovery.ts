// Discovery of NEW Janoshik public tests — the growth half of the Janoshik loop.
//
// The public portal (public.janoshik.com) shows a bounded window of recent tests; certificates
// roll off the feed but their verify URLs stay valid forever. annotateJanoshikListings()
// re-confirms what we already hold; this module captures what we DON'T hold yet before it rolls
// off — so the stored history grows past what the feed shows at any one moment. Each new test
// also mints any newly-seen reselling vendor (via the COA client field) as a live profile with
// a verifiable independent-lab history, exactly like the original bulk ingest.

import type { SqlConnection } from "@/server/db/client";
import { recordLabTest, classifyTestNote, type JanoshikEntry } from "./lab-tests";
import { deriveCoaVendors } from "./coa-vendors";
import { upsertLiveVendor } from "./live-sources";
import type { CompoundRef } from "./shopify-import";

export interface PurityRecord {
  purityPct?: number | null;
  batch?: string | null;
  measuredContent?: string | null;
  testedAt?: string | null;
}

/** The subset of feed entries not already stored, keyed on verify_url (the idempotency key). */
export function selectNewEntries(entries: JanoshikEntry[], knownVerifyUrls: Set<string>): JanoshikEntry[] {
  const seen = new Set<string>();
  const picked: JanoshikEntry[] = [];
  for (const e of entries) {
    if (!e.verifyUrl || knownVerifyUrls.has(e.verifyUrl) || seen.has(e.verifyUrl)) continue;
    seen.add(e.verifyUrl);
    picked.push(e);
  }
  return picked;
}

export async function getKnownVerifyUrls(db: SqlConnection): Promise<Set<string>> {
  const rows = (await db.query<{ verify_url: string }>(`SELECT verify_url FROM lab_test_records`)).rows;
  return new Set(rows.map((r) => r.verify_url));
}

export interface DiscoveryResult {
  feedSize: number;
  newTests: JanoshikEntry[];
  /** Vendor slugs that did not exist before this run. */
  newVendors: string[];
  compoundMatched: number;
  vendorLinked: number;
}

/**
 * Ingest every feed entry we don't already hold: derive + upsert any vendors those new COAs
 * name, then record each test (purity merged in where a vision-read record exists).
 */
export async function ingestNewJanoshikTests(
  db: SqlConnection,
  feedEntries: JanoshikEntry[],
  resolve: { compounds: CompoundRef[]; vendors: { slug: string; name: string; domain: string }[] },
  purities: Record<string, PurityRecord> = {},
): Promise<DiscoveryResult> {
  const newTests = selectNewEntries(feedEntries, await getKnownVerifyUrls(db));

  const { vendors: coaVendors, vendorByTestId } = deriveCoaVendors(newTests);
  const newVendors: string[] = [];
  for (const v of coaVendors) {
    const existed = (await db.query(`SELECT 1 FROM organizations WHERE slug=$1`, [v.slug])).rows.length > 0;
    await upsertLiveVendor(db, {
      slug: v.slug,
      name: v.name,
      domains: v.domain ? [v.domain] : [],
      description: `Identified from public third-party lab records (Janoshik). Independent test history aggregated by VialGrade; not an endorsement.`,
    });
    if (!existed) newVendors.push(v.slug);
  }

  let compoundMatched = 0;
  let vendorLinked = 0;
  for (const e of newTests) {
    const p = purities[e.testId] ?? {};
    const vendorSlug = vendorByTestId.get(e.testId) ?? null;
    if (vendorSlug) vendorLinked += 1;
    const cls = classifyTestNote(e.note);
    const res = await recordLabTest(db, {
      testId: e.testId,
      verifyUrl: e.verifyUrl,
      verifyKey: e.verifyKey,
      sampleName: e.sampleName,
      manufacturer: e.manufacturer,
      batchCode: p.batch ?? undefined,
      purityPct: p.purityPct ?? null,
      measuredContent: p.measuredContent ?? null,
      testedAt: p.testedAt ?? null,
      vendorSlug,
      testType: cls.testType,
      isBlind: cls.isBlind,
      testNote: e.note || null,
    }, resolve);
    if (res.compoundSlug) compoundMatched += 1;
  }

  return { feedSize: feedEntries.length, newTests, newVendors, compoundMatched, vendorLinked };
}

/**
 * Annotate stored COAs with the analysis type + blind flag read from the current feed note.
 * Same-source (the note lives in the same feed the COA came from), idempotent, and safe to run
 * on every pass — it back-fills rows ingested before test-type classification existed. Only writes
 * when the classification actually changes, and never clears a blind flag once set. Returns updated.
 */
export async function annotateTestTypes(db: SqlConnection, feedEntries: JanoshikEntry[]): Promise<number> {
  let updated = 0;
  for (const e of feedEntries) {
    if (!e.verifyUrl) continue;
    const { testType, isBlind } = classifyTestNote(e.note);
    const r = await db.query(
      `UPDATE lab_test_records
         SET test_type = $1, is_blind = is_blind OR $2, test_note = COALESCE($3, test_note), updated_at = NOW()
       WHERE verify_url = $4 AND (test_type <> $1 OR (is_blind = FALSE AND $2 = TRUE) OR test_note IS DISTINCT FROM COALESCE($3, test_note))`,
      [testType, isBlind, e.note || null, e.verifyUrl],
    );
    updated += r.rowCount ?? 0;
  }
  return updated;
}

/**
 * Backfill vision-read certificate values onto Janoshik rows already stored with gaps.
 * COALESCE semantics: never overwrites a value that is already present. Returns rows updated.
 */
export async function applyPurities(db: SqlConnection, purities: Record<string, PurityRecord>): Promise<number> {
  let updated = 0;
  for (const [testId, p] of Object.entries(purities)) {
    if (p.purityPct == null && !p.batch && !p.measuredContent && !p.testedAt) continue;
    const r = await db.query(
      `UPDATE lab_test_records
         SET purity_pct = COALESCE(purity_pct, $1),
             batch_code = COALESCE(batch_code, $2),
             measured_content = COALESCE(measured_content, $3),
             tested_at = COALESCE(tested_at, $4),
             updated_at = NOW()
       WHERE test_id = $5 AND lab = 'Janoshik Analytical'
         AND ((purity_pct IS NULL AND $1::numeric IS NOT NULL)
           OR (batch_code IS NULL AND $2::text IS NOT NULL)
           OR (measured_content IS NULL AND $3::text IS NOT NULL)
           OR (tested_at IS NULL AND $4::text IS NOT NULL))`,
      [p.purityPct ?? null, p.batch ?? null, p.measuredContent ?? null, p.testedAt ?? null, testId],
    );
    updated += r.rowCount ?? 0;
  }
  return updated;
}

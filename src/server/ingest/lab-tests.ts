// Independent lab-test (COA) records — the evidence-depth layer.
//
// parseJanoshikFeed() reads Janoshik's public test feed (server-rendered HTML) into entries.
// recordLabTest() stores a real COA reference — resolving the compound and (where possible)
// the vendor — including the measured purity read from the certificate image via vision.

import type { SqlConnection } from "@/server/db/client";
import { newId } from "@/server/db/ids";
import { matchCompound, type CompoundRef } from "./shopify-import";
import { canonicalizeLabName, labCountsAsIndependent } from "@/server/labs/registry";

export interface JanoshikEntry {
  testId: string;
  sampleName: string;
  manufacturer: string;
  client: string;
  verifyUrl: string;
  verifyKey: string;
  note: string; // the feed's test-type label, e.g. "Common GLP-1 peptide blind test (…)"
}

export type TestType = "purity" | "blend" | "sterility" | "endotoxin" | "heavy-metals" | "dimer" | "identity" | "screening";

/**
 * Classify a Janoshik feed note into an analysis category + a blind flag. Blind = a sample the
 * lab (or a buyer) obtained independently, so the vendor couldn't hand-pick it — the strongest
 * independence signal a certificate carries. Safety categories (sterility/endotoxin/heavy-metals)
 * prove something a purity test does not, so they're kept distinct rather than lumped as "purity".
 */
export function classifyTestNote(note: string): { testType: TestType; isBlind: boolean } {
  const n = (note ?? "").toLowerCase();
  const isBlind = /\bblind\b/.test(n);
  let testType: TestType = "purity";
  if (/sterilit/.test(n)) testType = "sterility";
  else if (/endotoxin/.test(n)) testType = "endotoxin";
  else if (/heavy metal/.test(n)) testType = "heavy-metals";
  else if (/\bdimer\b/.test(n)) testType = "dimer";
  else if (/screening/.test(n)) testType = "screening";
  else if (/\bblend\b|klow|glow|\bkpv\b.*\btb|(?:\/\s*(?:ghk|tb-?500|bpc-?157|kpv|ipamorelin|mod\s*grf))/.test(n)) testType = "blend";
  else if (/bac water|benzyl alcohol|\bwater\b/.test(n)) testType = "identity";
  return { testType, isBlind };
}

/** Parse the server-rendered Janoshik public feed into structured entries.
 *  Handles both plain rows and pinned ones (`<li class="sticky" data-test-id="…">`); a pinned
 *  duplicate of a main-list row collapses to one entry (first occurrence wins). */
export function parseJanoshikFeed(html: string): JanoshikEntry[] {
  const blocks = html.split(/<li[^>]*?data-test-id="/).slice(1);
  const entries: JanoshikEntry[] = [];
  const seen = new Set<string>();
  const strip = (s: string) => s.replace(/<[^>]+>/g, "").trim();
  for (const b of blocks) {
    const testId = b.slice(0, b.indexOf('"'));
    const href = /href="(https:\/\/verify\.janoshik\.com\/tests\/[^"]+)"/.exec(b);
    const sample = /<span class="sample">([\s\S]*?)<\/span>/.exec(b);
    const client = /<span class="client">([\s\S]*?)<\/span>/.exec(b);
    const mfr = /manufacturer">\s*Made By\s*([\s\S]*?)<\/span>/.exec(b);
    const note = /<span class="[^"]*\btiny\b[^"]*">([\s\S]*?)<\/span>/.exec(b);
    if (!href || !sample) continue;
    const url = href[1];
    if (seen.has(url)) continue;
    seen.add(url);
    const keyMatch = /_([A-Z0-9]{8,})$/.exec(url);
    entries.push({
      testId,
      sampleName: strip(sample[1]),
      manufacturer: mfr ? strip(mfr[1]) : "Unknown",
      client: client ? strip(client[1]) : "",
      verifyUrl: url,
      verifyKey: keyMatch ? keyMatch[1] : "",
      note: note ? strip(note[1]) : "",
    });
  }
  return entries;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Best-effort resolution of a COA manufacturer string to a known vendor slug. */
export function matchVendor(manufacturer: string, vendors: { slug: string; name: string; domain: string }[]): string | null {
  const m = norm(manufacturer);
  if (!m) return null;
  // Attribute a COA's manufacturer to a vendor by the MOST SPECIFIC key overlap — never the first in
  // the list (the old behavior silently gave the certificate to whichever vendor happened to iterate
  // earlier, inflating that vendor's "independently tested"). Keep the longest matching key per vendor,
  // then take the clear winner; a genuine tie between two different vendors is ambiguous, so we fail
  // toward null (the COA stays attributed at the compound level rather than to a confidently-wrong vendor).
  const hits: { slug: string; overlap: number }[] = [];
  for (const v of vendors) {
    const keys = [norm(v.name), norm(v.domain.replace(/\.[a-z]+$/, ""))].filter((k) => k.length >= 5);
    let best = 0;
    // Specificity is the length of the ACTUAL overlapping substring, not the vendor key's length: when
    // a short manufacturer token sits inside the key (k.includes(m)) the real overlap is m.length, so
    // two differently-sized keys both containing the same short token tie — and a tie fails to null.
    for (const k of keys) {
      const overlap = m.includes(k) ? k.length : k.includes(m) ? m.length : 0;
      if (overlap > best) best = overlap;
    }
    if (best) hits.push({ slug: v.slug, overlap: best });
  }
  if (hits.length === 0) return null;
  hits.sort((a, b) => b.overlap - a.overlap);
  if (hits.length === 1 || hits[0].overlap > hits[1].overlap) return hits[0].slug;
  return null; // two different vendors match equally well — don't guess
}

export interface LabTestInput {
  testId: string;
  verifyUrl: string;
  verifyKey?: string;
  sampleName: string;
  manufacturer: string;
  batchCode?: string;
  purityPct?: number | null;
  measuredContent?: string | null;
  testedAt?: string | null;
  lab?: string;
  vendorSlug?: string | null;   // pre-resolved vendor (e.g. from the COA client field); overrides matchVendor
  testType?: TestType;
  isBlind?: boolean;
  testNote?: string | null;
  /** False for a vendor's own self-branded COA where no independent lab is named. Defaults true. */
  isIndependent?: boolean;
}

/** Record (idempotently, keyed on verify_url) a real independent lab test. */
export async function recordLabTest(
  db: SqlConnection,
  input: LabTestInput,
  resolve: { compounds: CompoundRef[]; vendors: { slug: string; name: string; domain: string }[] },
): Promise<{ id: string; compoundSlug: string | null; vendorSlug: string | null }> {
  const compoundSlug = matchCompound(input.sampleName, resolve.compounds);
  const vendorSlug = input.vendorSlug ?? matchVendor(input.manufacturer, resolve.vendors);
  // The lab registry is authoritative: canonicalize the lab name (collapses "Janoshik" /
  // "Janoshik Analytical") and let it decide independence. A caller may only ever DOWNGRADE
  // (isIndependent:false); it can never vouch a lab independent beyond what the registry verifies.
  const lab = canonicalizeLabName(input.lab ?? "Janoshik Analytical");
  const isIndependent = labCountsAsIndependent(lab) && input.isIndependent !== false;
  const id = newId("labtest");
  await db.query(
    `INSERT INTO lab_test_records
       (id, lab, test_id, verify_url, verify_key, compound_slug, sample_name, manufacturer, vendor_slug, batch_code, purity_pct, measured_content, tested_at, test_type, is_blind, test_note, is_independent, origin)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'live')
     ON CONFLICT (verify_url) DO UPDATE
       SET purity_pct = COALESCE(EXCLUDED.purity_pct, lab_test_records.purity_pct),
           measured_content = COALESCE(EXCLUDED.measured_content, lab_test_records.measured_content),
           batch_code = COALESCE(EXCLUDED.batch_code, lab_test_records.batch_code),
           compound_slug = COALESCE(EXCLUDED.compound_slug, lab_test_records.compound_slug),
           vendor_slug = COALESCE(EXCLUDED.vendor_slug, lab_test_records.vendor_slug),
           tested_at = COALESCE(EXCLUDED.tested_at, lab_test_records.tested_at),
           test_type = EXCLUDED.test_type,
           is_blind = lab_test_records.is_blind OR EXCLUDED.is_blind,
           test_note = COALESCE(EXCLUDED.test_note, lab_test_records.test_note),
           is_independent = EXCLUDED.is_independent,
           updated_at = NOW()`,
    [id, lab, input.testId, input.verifyUrl, input.verifyKey ?? null, compoundSlug, input.sampleName, input.manufacturer, vendorSlug, input.batchCode ?? null, input.purityPct ?? null, input.measuredContent ?? null, input.testedAt ?? null, input.testType ?? "purity", input.isBlind ?? false, input.testNote ?? null, isIndependent],
  );
  return { id, compoundSlug, vendorSlug };
}

export interface LabTestRow {
  lab: string; test_id: string | null; verify_url: string; compound_slug: string | null;
  sample_name: string; manufacturer: string; vendor_slug: string | null; batch_code: string | null;
  purity_pct: string | number | null; measured_content: string | null; tested_at: string | null;
  janoshik_listed: boolean | null; janoshik_made_by: string | null; janoshik_checked_at: string | null;
  test_type: string; is_blind: boolean; test_note: string | null; is_independent: boolean;
}

const LAB_TEST_COLS = `lab,test_id,verify_url,compound_slug,sample_name,manufacturer,vendor_slug,batch_code,purity_pct,measured_content,tested_at,janoshik_listed,janoshik_made_by,janoshik_checked_at,test_type,is_blind,test_note,is_independent`;

export async function getLabTestsForCompound(db: SqlConnection, compoundSlug: string, limit = 20): Promise<LabTestRow[]> {
  // Independent records first, so a high-purity self-published row can never bump a counted
  // independent test out of the limit (which made the "N independent" stat exceed the rows shown).
  return (await db.query<LabTestRow>(
    `SELECT ${LAB_TEST_COLS} FROM lab_test_records WHERE compound_slug = $1 ORDER BY is_independent DESC, is_blind DESC, purity_pct DESC NULLS LAST, updated_at DESC LIMIT $2`,
    [compoundSlug, limit],
  )).rows;
}

export async function getLabTestsForVendor(db: SqlConnection, vendorSlug: string, limit = 12): Promise<LabTestRow[]> {
  return (await db.query<LabTestRow>(
    `SELECT ${LAB_TEST_COLS} FROM lab_test_records WHERE vendor_slug = $1 ORDER BY is_blind DESC, updated_at DESC LIMIT $2`,
    [vendorSlug, limit],
  )).rows;
}

/**
 * Reconcile every stored certificate against the lab registry: collapse split lab names to their
 * canonical form and recompute is_independent from the registry's tiering. Idempotent; run after
 * the registry changes or new rows land. Returns how many rows were corrected.
 */
export async function reconcileLabsFromRegistry(db: SqlConnection): Promise<{ renamed: number; independenceChanged: number }> {
  const rows = (await db.query<{ verify_url: string; lab: string; is_independent: boolean }>(
    `SELECT verify_url, lab, is_independent FROM lab_test_records`,
  )).rows;
  let renamed = 0, independenceChanged = 0;
  for (const r of rows) {
    const canon = canonicalizeLabName(r.lab);
    const indep = labCountsAsIndependent(canon);
    const nameChanged = canon !== r.lab;
    const indepChanged = indep !== r.is_independent;
    if (!nameChanged && !indepChanged) continue;
    await db.query(`UPDATE lab_test_records SET lab=$1, is_independent=$2, updated_at=NOW() WHERE verify_url=$3`, [canon, indep, r.verify_url]);
    if (nameChanged) renamed += 1;
    if (indepChanged) independenceChanged += 1;
  }
  return { renamed, independenceChanged };
}

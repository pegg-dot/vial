// Put the curated compound literature and regulatory facts into every database that boots.
//
// WHY THIS IS NOT A SCRIPT: it already was one (`scripts/ingest-external-data.mjs`), and the result
// was that production had NONE of it. Every live compound page was missing its entire "Scientific
// evidence & regulatory status" section, because the script is run by hand against whatever
// database the operator happens to be pointed at, and nobody had pointed it at production.
// Curated reference data that must exist on every deployment is not an errand.
//
// WHY THIS IS NOT (ONLY) A MIGRATION EITHER: a numbered migration runs exactly once. The first
// version of this file was migration 42, and the very next edit to the underlying JSON — nine
// records that had understated a live FDA restriction — would silently never have reached
// production, because 42 was already recorded as applied. That is the same failure as before
// wearing a different hat: an edit that looks shipped and is not.
//
// So the seed is CONTENT-ADDRESSED. It hashes the curated data, compares against the hash stored in
// `app_meta`, and re-seeds whenever they differ. Boot cost when nothing changed is a single SELECT.
// Editing the JSON is now sufficient to change production on the next deploy, which is what anyone
// editing a data file reasonably expects.
//
// SAFETY: this runs on the boot path, where a throw takes the whole application down (an earlier
// migration bug did exactly that and produced a four-minute outage). Every write is idempotent —
// `recordCompoundResearch` is ON CONFLICT DO UPDATE and `setCompoundRegulatory` is an UPDATE keyed
// on slug that COALESCEs, so a slug absent from `compounds` is a harmless no-op. Each record is
// isolated, and the whole pass is wrapped, so no data problem can stop a deployment from starting.
import { createHash } from "node:crypto";
import type { SqlConnection } from "./client";
import { recordCompoundResearch, setCompoundRegulatory } from "../external/repository";
import literature from "../data/compound-research.json";
import regulatory from "../data/compound-regulatory-status.json";

interface LiteratureRecord {
  compoundSlug: string;
  regulatoryStatus?: string | null;
  evidenceSummary?: string | null;
  findings?: { claim: string; studyType?: string | null; safetyNote?: string | null; sourceUrl: string; sourceTitle?: string | null }[];
}
interface RegulatoryRecord { slug: string; regulatoryStatus: string; fdaApproved: boolean }

const CONTENT_HASH = createHash("sha256")
  .update(JSON.stringify(literature))
  .update(JSON.stringify(regulatory))
  .digest("hex")
  .slice(0, 32);

export async function seedCompoundLiterature(db: SqlConnection): Promise<void> {
  for (const c of literature as LiteratureRecord[]) {
    try {
      await setCompoundRegulatory(db, c.compoundSlug, c.regulatoryStatus ?? null, c.evidenceSummary ?? null);
      for (const f of c.findings ?? []) {
        await recordCompoundResearch(db, { compoundSlug: c.compoundSlug, ...f });
      }
    } catch (error) {
      console.error(`[compound-literature] skipped ${c.compoundSlug}:`, error);
    }
  }

  // Applied second so the explicitly-sourced regulatory copy and its `fdaApproved` flag win over
  // the older literature file wherever both describe the same compound. The flag is what paints the
  // badge, and only these records declare it.
  for (const r of regulatory as RegulatoryRecord[]) {
    try {
      await setCompoundRegulatory(db, r.slug, r.regulatoryStatus, null, r.fdaApproved);
    } catch (error) {
      console.error(`[compound-literature] skipped regulatory ${r.slug}:`, error);
    }
  }
}

/** Re-seed only when the curated files have actually changed since the last boot. */
export async function ensureCompoundLiterature(db: SqlConnection): Promise<void> {
  try {
    const stored = (await db.query<{ value: { hash?: string } }>(
      `SELECT value FROM app_meta WHERE key='compound_literature_hash'`,
    )).rows[0]?.value;
    if (stored?.hash === CONTENT_HASH) return;

    await seedCompoundLiterature(db);
    await db.query(
      `INSERT INTO app_meta(key,value,updated_at) VALUES('compound_literature_hash',$1::jsonb,NOW())
       ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
      [JSON.stringify({ hash: CONTENT_HASH, seededAt: new Date().toISOString() })],
    );
    console.log(`[compound-literature] seeded ${(regulatory as RegulatoryRecord[]).length} regulatory records (${CONTENT_HASH})`);
  } catch (error) {
    // Never block a boot over reference data.
    console.error("[compound-literature] seed skipped:", error);
  }
}

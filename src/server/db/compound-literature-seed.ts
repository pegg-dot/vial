// Put the curated compound literature and regulatory facts into every database that boots.
//
// WHY THIS IS A MIGRATION AND NOT A SCRIPT: it already existed as a script
// (`scripts/ingest-external-data.mjs`), and the result was that production had NONE of it. Every
// live compound page was missing its entire "Scientific evidence & regulatory status" section —
// no findings, no evidence summary, no regulatory status — because the script is run by hand
// against whatever database the operator happens to be pointed at, and nobody had pointed it at
// production. Two separate causes, same silence:
//
//   1. `compound-research.json` used to live in `scripts/data/`, which is NOT bundled into the
//      serverless deployment. The same mistake once left /news empty. It now lives in
//      `src/server/data/` and is imported statically below, so the bundler has to include it.
//   2. Even bundled, nothing ran it in production. Migrations do run in production — that is how
//      the `is_bot` column reached the live tables — so the seed belongs here.
//
// Curated reference data that must exist on every deployment is schema, not an errand.
//
// SAFETY: this runs inside the boot migration path, where a throw takes the whole application
// down (an earlier migration bug did exactly that and produced a four-minute outage). So every
// write is idempotent — `recordCompoundResearch` is ON CONFLICT DO UPDATE, `setCompoundRegulatory`
// is an UPDATE keyed on slug that COALESCEs, and a slug absent from `compounds` is a harmless
// no-op rather than an error. Each record is additionally isolated so that one bad row can never
// prevent a deployment from starting.
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

export async function seedCompoundLiterature(db: SqlConnection): Promise<void> {
  for (const c of literature as LiteratureRecord[]) {
    try {
      await setCompoundRegulatory(db, c.compoundSlug, c.regulatoryStatus ?? null, c.evidenceSummary ?? null);
      for (const f of c.findings ?? []) {
        await recordCompoundResearch(db, { compoundSlug: c.compoundSlug, ...f });
      }
    } catch (error) {
      console.error(`[seed-literature] skipped ${c.compoundSlug}:`, error);
    }
  }

  // Applied second so the explicitly-sourced regulatory copy and its `fdaApproved` flag win over
  // the older literature file wherever both describe the same compound. The flag is what paints
  // the badge, and only these records declare it.
  for (const r of regulatory as RegulatoryRecord[]) {
    try {
      await setCompoundRegulatory(db, r.slug, r.regulatoryStatus, null, r.fdaApproved);
    } catch (error) {
      console.error(`[seed-literature] skipped regulatory ${r.slug}:`, error);
    }
  }
}

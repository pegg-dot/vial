// Apply the curated `regulatory_status` copy in
// `src/server/data/compound-regulatory-status.json` to the `compounds` table.
//
//   node --import tsx scripts/apply-compound-regulatory-status.mjs          # write
//   node --import tsx scripts/apply-compound-regulatory-status.mjs --dry-run # report only
//
// Idempotent: each row is a plain UPDATE keyed on `slug`, so re-running converges on the same
// state and never appends. `evidence_summary` is passed as null and therefore left untouched
// (`setCompoundRegulatory` COALESCEs it).
//
// Run with the dev server STOPPED — file-backed PGlite is single-writer — or against a managed
// DATABASE_URL.
//
// WHY `fdaApproved` IS WRITTEN, NOT INFERRED: `CompoundResearchPanel` used to decide the regulatory
// badge by running a regex over this very text — /FDA-approved/i AND NOT /Not FDA/i — so the
// sentence "Not AN FDA-approved drug" slipped past the negation and painted GHK-Cu, an unapproved
// substance, as approved on its live page. The panel now reads a stored boolean instead, and this
// script is what stores it. Wording can no longer decide a badge someone may act on.
//
// The flag means an approved DRUG exists containing the molecule — never that the material sold
// here is that drug. The panel renders it accordingly and has no green "approved" state at all.
process.env.VIALGRADE_SEED_FIXTURES ||= "false";
import { readFileSync } from "node:fs";
import { getDatabase } from "../src/server/db/client.ts";
import { setCompoundRegulatory } from "../src/server/external/repository.ts";

const DRY_RUN = process.argv.includes("--dry-run");

// Lives under src/ (not scripts/data/) so a deployment bundle can read it, matching
// regulatory-actions.json and known-vendors.json.
const SOURCE = new URL("../src/server/data/compound-regulatory-status.json", import.meta.url);
const records = JSON.parse(readFileSync(SOURCE, "utf8"));

// Prose and flag must still agree — not because the badge depends on the prose any more, but
// because a record whose sentence says "not approved" while its flag says approved is a research
// error, and this is the last place to catch it before it reaches a page.
const proseReadsApproved = (text) =>
  /FDA-approved/i.test(text) && !/\b(?:not|no|never|nor|isn't|aren't|without)\b[^.;]{0,24}FDA-approved/i.test(text);

const problems = [];
const seen = new Set();
for (const r of records) {
  const where = r.slug ?? "(missing slug)";
  if (!r.slug || typeof r.slug !== "string") problems.push(`${where}: missing slug`);
  if (seen.has(r.slug)) problems.push(`${where}: duplicate slug`);
  seen.add(r.slug);
  if (typeof r.regulatoryStatus !== "string" || r.regulatoryStatus.trim().length < 20) problems.push(`${where}: regulatoryStatus missing or too short`);
  if (typeof r.fdaApproved !== "boolean") problems.push(`${where}: fdaApproved must be a boolean`);
  if (!Array.isArray(r.sourceUrls) || r.sourceUrls.length === 0) problems.push(`${where}: at least one source URL is required`);
  for (const u of r.sourceUrls ?? []) if (!/^https:\/\//.test(u)) problems.push(`${where}: source URL must be https — ${u}`);
  if (typeof r.regulatoryStatus === "string" && typeof r.fdaApproved === "boolean" && proseReadsApproved(r.regulatoryStatus) !== r.fdaApproved) {
    problems.push(`${where}: prose reads as ${proseReadsApproved(r.regulatoryStatus) ? "APPROVED" : "not approved"} but fdaApproved=${r.fdaApproved} — one of the two is wrong`);
  }
}
if (problems.length) {
  console.error(`Refusing to write. ${problems.length} problem(s) in compound-regulatory-status.json:`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}

const db = await getDatabase();
const before = (await db.query(`SELECT COUNT(*)::int AS n FROM compounds WHERE regulatory_status IS NOT NULL`)).rows[0].n;
const total = (await db.query(`SELECT COUNT(*)::int AS n FROM compounds`)).rows[0].n;

const known = new Set((await db.query(`SELECT slug FROM compounds`)).rows.map((r) => r.slug));
const unknown = records.filter((r) => !known.has(r.slug)).map((r) => r.slug);
if (unknown.length) {
  console.error(`Refusing to write. ${unknown.length} slug(s) are not in the compounds table: ${unknown.join(", ")}`);
  process.exit(1);
}

console.log(`compounds: ${before}/${total} had a regulatory_status before this run.`);
console.log(`${records.length} curated record(s) to apply${DRY_RUN ? " (dry run — nothing will be written)" : ""}.\n`);

let written = 0, unchanged = 0;
for (const r of records) {
  const row = (await db.query(`SELECT regulatory_status, fda_approved_drug_exists FROM compounds WHERE slug=$1`, [r.slug])).rows[0];
  const current = row?.regulatory_status ?? null;
  if (current === r.regulatoryStatus && row?.fda_approved_drug_exists === r.fdaApproved) { unchanged += 1; console.log(`  =  ${r.slug.padEnd(24)} already current`); continue; }
  if (!DRY_RUN) await setCompoundRegulatory(db, r.slug, r.regulatoryStatus, null, r.fdaApproved);
  written += 1;
  console.log(`  ${current ? "~" : "+"}  ${r.slug.padEnd(24)} ${r.regulatoryStatus.slice(0, 88)}${r.regulatoryStatus.length > 88 ? "…" : ""}`);
}

const after = (await db.query(`SELECT COUNT(*)::int AS n FROM compounds WHERE regulatory_status IS NOT NULL`)).rows[0].n;
console.log(`\n${written} written, ${unchanged} already current.`);
console.log(`compounds with a regulatory_status: ${before} → ${after} (of ${total}).`);
const blank = (await db.query(`SELECT slug FROM compounds WHERE regulatory_status IS NULL ORDER BY slug`)).rows.map((r) => r.slug);
if (blank.length) console.log(`Still blank (${blank.length}): ${blank.join(", ")}`);
process.exit(0);

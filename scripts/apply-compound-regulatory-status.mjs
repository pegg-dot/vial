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
// WHY THE `fdaApproved` FLAG IS CHECKED HERE: `CompoundResearchPanel` decides whether to paint the
// regulatory card green ("approved") or amber ("caution") by running a regex over this very text —
// /FDA-approved/i AND NOT /Not FDA/i. That means a sentence like "no FDA-approved product contains
// it" would render as an APPROVAL to a buyer. Every record therefore declares the badge it intends,
// and this script refuses to write if the rendered badge would disagree. A wrong badge on a
// substance someone may inject is the failure mode worth a hard stop.
process.env.VIALGRADE_SEED_FIXTURES ||= "false";
import { readFileSync } from "node:fs";
import { getDatabase } from "../src/server/db/client.ts";
import { setCompoundRegulatory } from "../src/server/external/repository.ts";

const DRY_RUN = process.argv.includes("--dry-run");

// Lives under src/ (not scripts/data/) so a deployment bundle can read it, matching
// regulatory-actions.json and known-vendors.json.
const SOURCE = new URL("../src/server/data/compound-regulatory-status.json", import.meta.url);
const records = JSON.parse(readFileSync(SOURCE, "utf8"));

/** Mirror of the badge rule in src/components/compound-research-panel.tsx. Keep in sync. */
const rendersAsApproved = (text) => /FDA-approved/i.test(text) && !/Not FDA/i.test(text);

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
  if (typeof r.regulatoryStatus === "string" && typeof r.fdaApproved === "boolean" && rendersAsApproved(r.regulatoryStatus) !== r.fdaApproved) {
    problems.push(`${where}: copy renders as ${rendersAsApproved(r.regulatoryStatus) ? "APPROVED" : "not approved"} but fdaApproved=${r.fdaApproved} — rewrite the sentence`);
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
  const current = (await db.query(`SELECT regulatory_status FROM compounds WHERE slug=$1`, [r.slug])).rows[0]?.regulatory_status ?? null;
  if (current === r.regulatoryStatus) { unchanged += 1; console.log(`  =  ${r.slug.padEnd(24)} already current`); continue; }
  if (!DRY_RUN) await setCompoundRegulatory(db, r.slug, r.regulatoryStatus, null);
  written += 1;
  console.log(`  ${current ? "~" : "+"}  ${r.slug.padEnd(24)} ${r.regulatoryStatus.slice(0, 88)}${r.regulatoryStatus.length > 88 ? "…" : ""}`);
}

const after = (await db.query(`SELECT COUNT(*)::int AS n FROM compounds WHERE regulatory_status IS NOT NULL`)).rows[0].n;
console.log(`\n${written} written, ${unchanged} already current.`);
console.log(`compounds with a regulatory_status: ${before} → ${after} (of ${total}).`);
const blank = (await db.query(`SELECT slug FROM compounds WHERE regulatory_status IS NULL ORDER BY slug`)).rows.map((r) => r.slug);
if (blank.length) console.log(`Still blank (${blank.length}): ${blank.join(", ")}`);
process.exit(0);

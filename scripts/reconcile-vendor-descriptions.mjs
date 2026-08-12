// Published vendor descriptions drift: the curated vendor list gets corrected (e.g. after a DOJ
// case lands) but the row written by an earlier ingest keeps the old, now-misleading blurb. That
// puts "generally considered legitimate" on screen next to an F. This reconciles stored
// descriptions against the CURRENT source list.
//
// Idempotent. Pass --apply to write; the default is a dry run.
import { readFile } from "node:fs/promises";
import { getDatabase, resetDatabaseForTests } from "../src/server/db/client.ts";

const apply = process.argv.includes("--apply");
const SUFFIX = "Aggregated from public sources; VialGrade does not endorse any vendor.";

const vendors = JSON.parse(await readFile("scripts/data/peptide-vendors.json", "utf8"));
const list = Array.isArray(vendors) ? vendors : (vendors.vendors ?? []);
const bySlug = new Map(list.filter(v => v.slug).map(v => [v.slug, v]));

const db = await getDatabase();
const rows = (await db.query(
  `SELECT slug,display_name,description FROM organizations
   WHERE origin='live' AND organization_type='vendor' ORDER BY slug`,
)).rows;

const drift = [];
for (const row of rows) {
  const source = bySlug.get(row.slug);
  if (!source?.reputationSummary) continue;
  const expected = `${source.reputationSummary} ${SUFFIX}`;
  const current = String(row.description ?? "").trim();
  // Only reconcile rows whose blurb is the ingest-authored shape; never overwrite a description
  // that came from somewhere else.
  if (!current.endsWith(SUFFIX)) continue;
  if (current === expected) continue;
  drift.push({ slug: row.slug, name: row.display_name, current, expected });
  if (apply) {
    await db.query(`UPDATE organizations SET description=$2,updated_at=NOW() WHERE slug=$1`, [row.slug, expected]);
  }
}

console.log(`\n=== vendor description drift ${apply ? "(APPLIED)" : "(dry run — pass --apply to write)"} ===\n`);
for (const d of drift) {
  console.log(`  ${d.name} (/vendors/${d.slug})`);
  console.log(`    stored:  ${d.current.slice(0, 118)}`);
  console.log(`    source:  ${d.expected.slice(0, 118)}\n`);
}
console.log(`  ${drift.length} of ${rows.length} live vendors drifted from the curated source\n`);

await resetDatabaseForTests();
process.exit(0);

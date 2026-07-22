// One-time, idempotent, in-place merge of near-duplicate COA-derived vendors.
//
// The COA "client" field spells the same reseller two ways ("Zztai Peptide" vs "Zztai Peptide Ltd",
// "admin-rayshine-peptide" vs "rayshine-peptide"), splitting one vendor's independent lab history
// across ghost duplicate profiles. This re-points every row from the duplicate slug onto the
// canonical one and deletes the orphan org, so each vendor shows ALL its COAs. The root cause is
// fixed in cleanVendorString (future ingests are already canonical); this heals what's stored.
//
//   node --import tsx scripts/normalize-vendor-slugs.mjs
// Run with the dev server STOPPED (file-backed PGlite is single-writer).
import { getDatabase } from "../src/server/db/client.ts";
import { canonicalizeVendorSlug, canonicalizeVendorName } from "../src/server/ingest/coa-vendors.ts";
import { computeAndStoreLinkages } from "../src/server/verify/vendor-linkage.ts";

const db = await getDatabase();

// Live vendors + their COA counts, grouped by canonical slug.
const orgs = (await db.query(
  `SELECT o.slug, o.display_name, COUNT(t.id)::int coas
   FROM organizations o LEFT JOIN lab_test_records t ON t.vendor_slug=o.slug
   WHERE o.origin='live' AND o.organization_type='vendor'
   GROUP BY o.slug, o.display_name`,
)).rows;
const clusters = new Map();
for (const o of orgs) {
  const c = canonicalizeVendorSlug(o.slug);
  if (!clusters.has(c)) clusters.set(c, []);
  clusters.get(c).push(o);
}

// Tables that hold many rows per vendor — safe to bulk re-point.
const MANY = ["lab_test_records", "price_observations", "community_mentions", "vendor_fingerprints"];
// Tables with at most one row per vendor — re-point only if the target has none, else drop the dupe.
const ONE = ["vendor_status", "vendor_reviews", "vendor_flags"];

let merged = 0;
for (const [canonical, members] of clusters) {
  if (members.length < 2) continue;
  members.sort((a, b) => b.coas - a.coas); // most COAs first
  // Ensure a canonical-slug org exists: rename the richest member if needed.
  let target = members.find((m) => m.slug === canonical);
  if (!target) {
    target = members[0];
    await db.query(`UPDATE organizations SET slug=$1, display_name=$2 WHERE slug=$3`, [canonical, canonicalizeVendorName(target.display_name), target.slug]);
    target = { ...target, slug: canonical };
  }
  const sources = members.filter((m) => m.slug !== canonical);
  for (const s of sources) {
    for (const tbl of MANY) await db.query(`UPDATE ${tbl} SET vendor_slug=$1 WHERE vendor_slug=$2`, [canonical, s.slug]);
    for (const tbl of ONE) {
      const has = (await db.query(`SELECT 1 FROM ${tbl} WHERE vendor_slug=$1 LIMIT 1`, [canonical])).rows.length > 0;
      if (has) await db.query(`DELETE FROM ${tbl} WHERE vendor_slug=$1`, [s.slug]);
      else await db.query(`UPDATE ${tbl} SET vendor_slug=$1 WHERE vendor_slug=$2`, [canonical, s.slug]);
    }
    await db.query(`DELETE FROM organizations WHERE slug=$1`, [s.slug]);
    console.log(`  merged ${s.slug} (${s.coas} coas) → ${canonical}`);
    merged++;
  }
}
console.log(merged ? `\nMerged ${merged} duplicate vendor(s). Rebuilding linkage graph…` : "No duplicate vendors found — already canonical.");
if (merged) await computeAndStoreLinkages(db);
process.exit(0);

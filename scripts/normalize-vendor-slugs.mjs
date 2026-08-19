// Reconcile duplicate vendor profiles — one business, one row. DRY RUN BY DEFAULT.
//
// The COA "client" field spells the same reseller several ways ("HHM Peptide Ltd" on one
// certificate, the canonicalised "HHM Peptide" on the next ingest generation; "admin@rayshine-
// peptide" instead of "Rayshine Peptide"). Every spelling minted its own organization, which both
// splits one vendor's independent lab history across ghost profiles and inflates the vendor count
// the site publishes as a headline figure. cleanVendorString() fixed the mint; this heals the store.
//
//   node --import tsx scripts/normalize-vendor-slugs.mjs            # report only, writes nothing
//   node --import tsx scripts/normalize-vendor-slugs.mjs --apply    # perform the merge
//
// Run with the dev server STOPPED (file-backed PGlite is single-writer). Against production, set
// DATABASE_URL. The merge runs in ONE transaction and aborts if the before/after evidence census
// does not balance, so a partial merge cannot be left behind.
import { getDatabase } from "../src/server/db/client.ts";
import { planVendorMerges, applyVendorMerges } from "../src/server/vendors/merge.ts";
import { computeAndStoreLinkages } from "../src/server/verify/vendor-linkage.ts";
import { rebuildSearchIndex } from "../src/server/search/engine.ts";
import { projectMarketDataRegistry } from "../src/server/registry/repository.ts";
import { recomputeAllVendorGrades } from "../src/server/verify/grade-store.ts";

const apply = process.argv.includes("--apply");
const db = await getDatabase();
const plan = await planVendorMerges(db);

console.log(`\nVENDOR HEADLINE COUNT: ${plan.vendorCountBefore} → ${plan.vendorCountAfter}\n`);

if (plan.malformedNames.length) {
  console.log("Display names that are not company names:");
  for (const n of plan.malformedNames) console.log(`  ${n.slug.padEnd(30)} "${n.displayName}"  (${n.reason})`);
  console.log("");
}

if (!plan.clusters.length) console.log("No duplicate vendors — every profile is already canonical.\n");
for (const c of plan.clusters) {
  console.log(`Cluster "${c.canonical}"`);
  if (c.rename) console.log(`  RENAME  ${c.rename.from} → ${c.rename.to}`);
  console.log(`  KEEP    ${c.survivor.slug.padEnd(28)} ${c.survivor.evidenceRows} evidence rows`);
  for (const a of c.absorbed) {
    console.log(`  ABSORB  ${a.slug.padEnd(28)} ${a.evidenceRows} evidence rows  "${a.displayName}"`);
    for (const [k, v] of Object.entries(a.census)) console.log(`            ${k} = ${v}`);
  }
}

if (plan.residue.length) {
  console.log("\nIdentity records left behind by an earlier, incomplete merge:");
  for (const r of plan.residue) console.log(`  ${r.kind.padEnd(20)} ${r.id}  →  ${r.danglingRef} (${r.resolvesTo ? `resolves to ${r.resolvesTo}` : "UNRESOLVED — reported only"})`);
}

if (!apply) {
  const result = await applyVendorMerges(db, plan, { apply: false });
  console.log(`\nDRY RUN — nothing was written. ${result.merges.length} merge(s), ${result.renames.length} rename(s), ${result.residueRepaired.length} identity record(s) would be repaired.`);
  console.log("Re-run with --apply to perform it.\n");
  process.exit(0);
}

const result = await db.transaction(async (tx) => {
  const r = await applyVendorMerges(tx, plan, { apply: true });
  const unbalanced = r.merges.filter((m) => !m.balanced);
  if (unbalanced.length) throw new Error(`Evidence census did not balance for: ${unbalanced.map((m) => m.cluster).join(", ")} — rolled back.`);
  return r;
});

console.log("\nAPPLIED.");
for (const m of result.merges) {
  const before = Object.values(m.before).reduce((a, b) => a + b, 0);
  const after = Object.values(m.after).reduce((a, b) => a + b, 0);
  const collapsed = m.collapsed.reduce((a, c) => a + c.rows, 0);
  console.log(`  ${m.cluster.padEnd(24)} evidence ${before} → ${after}${collapsed ? ` (+${collapsed} duplicate row(s) collapsed: ${m.collapsed.map((c) => `${c.table}.${c.column}×${c.rows}`).join(", ")})` : ""}  balanced=${m.balanced}`);
}
for (const r of result.residueRepaired) console.log(`  repaired ${r.kind} ${r.id}`);
for (const r of result.residueSkipped) console.log(`  SKIPPED  ${r.kind} ${r.id} — could not be resolved to a live vendor; left untouched`);

// Fixing the rows does not heal what was derived FROM them: the linkage graph, the search index,
// the public registry projection and the stored letter grades all still describe the pre-merge
// world until they are rebuilt.
console.log("\nRebuilding derived layers…");
const links = await computeAndStoreLinkages(db);
const search = await rebuildSearchIndex(db);
const registry = await projectMarketDataRegistry(db);
const grades = await recomputeAllVendorGrades({ connection: db });
console.log(`  vendor_links ${links.edges} edges · search ${search.count} documents · registry ${registry.count} identifiers · grades ${grades.graded} recomputed`);
console.log(`\nVENDOR HEADLINE COUNT: ${result.vendorCountBefore} → ${result.vendorCountAfter}`);
console.log("The catalog snapshot is cached per deploy — call revalidateTag(CATALOG_CACHE_TAG) or redeploy for the new count to appear.\n");
process.exit(0);

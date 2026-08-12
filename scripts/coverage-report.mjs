// The coverage number that decides whether the terminal is useful: of every live listing, what
// share carries real independent lab evidence versus showing "No lab test"?
//
// docs/STOREFRONT-COA.md put this at ~11% before the storefront-COA wedge landed. This measures it.
import { getDatabase, resetDatabaseForTests } from "../src/server/db/client.ts";
import { computeListingTrustMap } from "../src/server/verify/listing-trust.ts";

const db = await getDatabase();
const listings = (await db.query(
  `SELECT l.slug, o.slug vendor_slug, c.slug compound_slug,
          l.report_issuer, l.report_confirmed, l.batch_code, l.price
   FROM listings l
   JOIN products p ON p.id = l.product_id
   JOIN organizations o ON o.id = p.vendor_id
   JOIN compounds c ON c.id = p.compound_id
   WHERE l.origin='live'`,
)).rows;

const trust = await computeListingTrustMap(db, listings.map(r => ({
  slug: r.slug,
  vendorSlug: r.vendor_slug,
  compoundSlug: r.compound_slug,
  reportIssuer: r.report_issuer ?? undefined,
  reportConfirmed: r.report_confirmed ?? undefined,
  batchCode: r.batch_code ?? undefined,
  price: r.price == null ? undefined : Number(r.price),
})));

const counts = new Map();
for (const t of trust.values()) counts.set(t.status, (counts.get(t.status) ?? 0) + 1);

const ORDER = ["batch-verified", "verified", "low-purity", "mismatch", "unbacked", "no-claim"];
const total = listings.length;
console.log(`\n=== Listing evidence coverage across ${total} live listings ===\n`);
for (const status of ORDER) {
  const n = counts.get(status) ?? 0;
  const pct = total ? ((n / total) * 100).toFixed(1) : "0.0";
  console.log(`  ${status.padEnd(16)} ${String(n).padStart(4)}  ${pct.padStart(5)}%  ${"█".repeat(Math.round((n / Math.max(total, 1)) * 46))}`);
}

const backed = (counts.get("batch-verified") ?? 0) + (counts.get("verified") ?? 0);
const noClaim = counts.get("no-claim") ?? 0;
console.log(`\n  REAL INDEPENDENT EVIDENCE : ${backed}/${total} (${total ? ((backed / total) * 100).toFixed(1) : 0}%)`);
console.log(`  shows "No lab test"       : ${noClaim}/${total} (${total ? ((noClaim / total) * 100).toFixed(1) : 0}%)`);

// The wedge's own target: storefront-published Janoshik links resolved into held certificates.
const claims = Number((await db.query(
  `SELECT COUNT(*) c FROM listings WHERE origin='live' AND report_issuer IS NOT NULL AND report_issuer <> ''`,
)).rows[0].c);
console.log(`  listings advertising a test: ${claims}/${total} (${total ? ((claims / total) * 100).toFixed(1) : 0}%)\n`);

await resetDatabaseForTests();
process.exit(0);

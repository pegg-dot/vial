// Self-contained smoke for the storefront-published COA wedge. In-memory DB, fixture products, NO
// real network and NO touch of the dev .data — safe to run while `next dev` is up.
//   node --import tsx scripts/smoke-storefront-coa.mjs
//
// It seeds a demo storefront + the certificates VIAL "already holds", then runs the REAL
// importShopifyCatalog on four fixture products and prints, for each, what the storefront published
// and the verdict the hardened crossCheckCoa reaches from the wedge's stamp. This shows both the
// coverage win and the honesty guards in one readable run.
process.env.VIAL_PGLITE_MEMORY = "true";
process.env.VIAL_SESSION_SECRET ||= "smoke-storefront-coa-secret-at-least-32chars";
process.env.VIAL_PRIVACY_HASH_SECRET ||= "smoke-storefront-coa-privacy-at-least-32chars";

import { getDatabase, resetDatabaseForTests } from "../src/server/db/client.ts";
import { newId } from "../src/server/db/ids.ts";
import { upsertLiveCompound } from "../src/server/ingest/live-sources.ts";
import { importShopifyCatalog } from "../src/server/ingest/shopify-import.ts";
import { crossCheckCoa } from "../src/server/verify/coa-cross-check.ts";

const VENDOR = "demo-store";
const HELD_BPC = "https://verify.janoshik.com/tests/551234-BPC157_K9Z"; // a cert VIAL holds, made by demo-store
const FOREIGN_CJC = "https://verify.janoshik.com/tests/660987-CJC1295_A7Q"; // a cert VIAL holds, made by SOMEONE ELSE

await resetDatabaseForTests();
const db = await getDatabase();

async function compound(slug, name) {
  await upsertLiveCompound(db, { slug, name, shorthand: name, category: "Peptide", description: `${name}`, aliases: [name] });
}
async function heldCert({ vendor_slug, manufacturer, compound_slug, verify, batch, purity }) {
  await db.query(
    `INSERT INTO lab_test_records (id,lab,verify_url,verify_key,compound_slug,sample_name,manufacturer,vendor_slug,batch_code,purity_pct,is_independent,origin)
     VALUES ($1,'Janoshik Analytical',$2,$3,$4,$5,$6,$7,$8,$9,TRUE,'live')`,
    [newId("labtest"), verify, "K" + Math.floor(purity), compound_slug, compound_slug, manufacturer, vendor_slug, batch, purity],
  );
}

// Compounds sold.
for (const [s, n] of [["bpc-157", "BPC-157"], ["tb-500", "TB-500"], ["cjc-1295", "CJC-1295"], ["ipamorelin", "Ipamorelin"]]) await compound(s, n);

// Certificates VIAL already independently holds (from the Janoshik feed):
await heldCert({ vendor_slug: VENDOR, manufacturer: "Demo Store", compound_slug: "bpc-157", verify: HELD_BPC, batch: "2026-05-01-A", purity: 99.4 }); // demo-store's OWN
await heldCert({ vendor_slug: "some-other-maker", manufacturer: "Some Other Maker", compound_slug: "cjc-1295", verify: FOREIGN_CJC, batch: "OM-2026-114-Z", purity: 98.9 }); // a DIFFERENT maker's

// Four fixture products the storefront "publishes":
const variants = (price) => [{ title: "5mg", price, available: true }];
const products = [
  // 1) publishes its OWN Janoshik COA
  { title: "BPC-157 5mg", handle: "bpc", variants: variants("42.00"), body_html: `<p>Third-party tested — <a href="${HELD_BPC}">Janoshik COA</a></p>` },
  // 2) publishes NO COA link
  { title: "TB-500 5mg", handle: "tb", variants: variants("55.00"), body_html: `<p>Lyophilized powder. Research use only.</p>` },
  // 3) publishes a link to a DIFFERENT maker's cert (a reseller)
  { title: "CJC-1295 5mg", handle: "cjc", variants: variants("48.00"), body_html: `<p>COA: <a href="${FOREIGN_CJC}">verify here</a></p>` },
  // 4) pastes the BPC-157 COA link into an unrelated Ipamorelin product (boilerplate footer)
  { title: "Ipamorelin 5mg", handle: "ipa", variants: variants("39.00"), body_html: `<footer>Lab results: <a href="${HELD_BPC}">COA</a></footer>` },
];

console.log("\nRunning importShopifyCatalog (the real ingest path, with fixture products)…\n");
await importShopifyCatalog(db, {
  vendorSlug: VENDOR, vendorName: "Demo Store", domain: "demostore.com", description: "smoke",
  compounds: [{ slug: "bpc-157", name: "BPC-157", aliases: [] }, { slug: "tb-500", name: "TB-500", aliases: [] }, { slug: "cjc-1295", name: "CJC-1295", aliases: [] }, { slug: "ipamorelin", name: "Ipamorelin", aliases: [] }],
  products,
});

const scenarios = [
  ["bpc-157", "BPC-157", "publishes its OWN Janoshik COA"],
  ["tb-500", "TB-500", "publishes no COA link"],
  ["cjc-1295", "CJC-1295", "links a DIFFERENT maker's cert (reseller)"],
  ["ipamorelin", "Ipamorelin", "pastes the BPC-157 COA link in a footer"],
];

console.log("─".repeat(96));
console.log("PRODUCT".padEnd(14), "WHAT THE STOREFRONT PUBLISHED".padEnd(42), "STAMPED".padEnd(10), "VIAL VERDICT");
console.log("─".repeat(96));
for (const [slug, name, what] of scenarios) {
  const l = (await db.query(`SELECT report_issuer, report_confirmed, batch_code FROM listings WHERE slug = $1`, [`${VENDOR}-${slug}`])).rows[0] ?? {};
  // Feed the STAMPED listing fields into the same cross-check the product page runs.
  const r = await crossCheckCoa(db, {
    vendorSlug: VENDOR, vendorName: "Demo Store", compoundSlug: slug, compoundName: name,
    reportIssuer: l.report_issuer || "", reportConfirmed: Boolean(l.report_confirmed), batchCode: l.batch_code || "",
  });
  const stamped = l.report_issuer ? `${l.report_issuer}${l.batch_code ? " +batch" : ""}` : "—";
  const purity = r.independentPurity != null ? ` (${Number(r.independentPurity).toFixed(1)}%)` : "";
  console.log(name.padEnd(14), what.padEnd(42), stamped.padEnd(10), `${r.status}${purity}`);
}
console.log("─".repeat(96));
console.log("\nBefore the wedge every one of these would read \"no-claim / No lab test\".");
console.log("After: the seller's own COA → batch-verified with the real purity; a foreign cert → honest");
console.log("\"unbacked\" (advertises testing, not a counterfeit accusation); no link / wrong-compound footer → still no-claim.\n");

await resetDatabaseForTests();
process.exit(0);

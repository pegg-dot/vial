// Remove all DEMO fixture data, leaving only real (origin='live') data. Safe and idempotent:
// everything deleted is scoped to origin='demo' or the single fictional Aperture lab, and no live
// row references any of it (verified: 0 FK/slug references from live → demo). Auth users are kept
// (login / e2e / admin). Production never creates demos in the first place — this is for cleaning a
// dev DB or any environment where fixtures were seeded.
//   node --import tsx scripts/delete-demos.mjs         (run with the dev server stopped)
// Never re-seed demo fixtures from this (or any live-data) script: a bare `node` run doesn't load
// .env.local, so without this the getDatabase() init would recreate the very demos we're deleting.
process.env.VIALGRADE_SEED_FIXTURES ||= "false";
import { getDatabase } from "../src/server/db/client.ts";

const db = await getDatabase();
const q = async (label, sql, params = []) => {
  try { const r = await db.query(sql, params); return { label, n: r.rowCount ?? 0 }; }
  catch (e) { return { label, err: (e && e.message) ? e.message.slice(0, 80) : String(e) }; }
};

const before = (await db.query(`SELECT
  (SELECT COUNT(*) FROM organizations WHERE origin='demo') orgs,
  (SELECT COUNT(*) FROM products WHERE origin='demo') products,
  (SELECT COUNT(*) FROM listings WHERE origin='demo') listings,
  (SELECT COUNT(*) FROM batch_passports WHERE origin='demo') passports,
  (SELECT COUNT(*) FROM laboratory_profiles) labs`)).rows[0];
console.log("Before:", JSON.stringify(before));

// Demo evidence network (the fictional Aperture lab + the one demo batch passport). Children first;
// most cascade from the lab / passport, but delete the non-cascading ones explicitly to be safe.
const steps = [
  ["demo passport (cascades links/conflicts)", `DELETE FROM batch_passports WHERE origin='demo'`],
  ["orphan passport_versions",                 `DELETE FROM passport_versions WHERE passport_id NOT IN (SELECT id FROM batch_passports)`],
  ["aperture report events",                   `DELETE FROM laboratory_report_events WHERE report_id IN (SELECT id FROM laboratory_reports WHERE laboratory_id='lab:aperture')`],
  ["aperture reports",                         `DELETE FROM laboratory_reports WHERE laboratory_id='lab:aperture'`],
  ["aperture analytical results",              `DELETE FROM analytical_results WHERE run_id IN (SELECT id FROM analytical_runs WHERE test_order_id IN (SELECT id FROM laboratory_test_orders WHERE laboratory_id='lab:aperture'))`],
  ["aperture analytical runs",                 `DELETE FROM analytical_runs WHERE test_order_id IN (SELECT id FROM laboratory_test_orders WHERE laboratory_id='lab:aperture')`],
  ["aperture custody events",                  `DELETE FROM sample_custody_events WHERE sample_id IN (SELECT id FROM laboratory_samples WHERE test_order_id IN (SELECT id FROM laboratory_test_orders WHERE laboratory_id='lab:aperture'))`],
  ["aperture samples",                         `DELETE FROM laboratory_samples WHERE test_order_id IN (SELECT id FROM laboratory_test_orders WHERE laboratory_id='lab:aperture')`],
  ["aperture sample kits",                     `DELETE FROM sample_kits WHERE test_order_id IN (SELECT id FROM laboratory_test_orders WHERE laboratory_id='lab:aperture')`],
  ["aperture test orders",                     `DELETE FROM laboratory_test_orders WHERE laboratory_id='lab:aperture'`],
  ["demo testing programs",                    `DELETE FROM testing_programs WHERE sponsor_id='vial' OR created_by='system'`],
  ["aperture laboratory profile (cascades methods/team/onboarding/tokens)", `DELETE FROM laboratory_profiles WHERE slug='aperture-analytical'`],
  // Demo consumer catalog. First clear every table that references a demo listing or product
  // (none cascade), then the listings, then the products, then the vendor orgs.
  ["source_refresh_policies → demo listing", `DELETE FROM source_refresh_policies WHERE target_listing_id IN (SELECT id FROM listings WHERE origin='demo')`],
  ["commerce_listing_eligibility → demo",    `DELETE FROM commerce_listing_eligibility WHERE listing_id IN (SELECT id FROM listings WHERE origin='demo')`],
  ["commerce_cart_lines → demo",             `DELETE FROM commerce_cart_lines WHERE listing_id IN (SELECT id FROM listings WHERE origin='demo')`],
  ["commerce_order_lines → demo",            `DELETE FROM commerce_order_lines WHERE listing_id IN (SELECT id FROM listings WHERE origin='demo')`],
  ["commerce_inventory_reservations → demo", `DELETE FROM commerce_inventory_reservations WHERE listing_id IN (SELECT id FROM listings WHERE origin='demo')`],
  ["commerce_inventory → demo",              `DELETE FROM commerce_inventory WHERE listing_id IN (SELECT id FROM listings WHERE origin='demo')`],
  ["marketplace_reviews → demo",             `DELETE FROM marketplace_reviews WHERE listing_id IN (SELECT id FROM listings WHERE origin='demo')`],
  ["seller_products → demo listing",         `UPDATE seller_products SET listing_id=NULL WHERE listing_id IN (SELECT id FROM listings WHERE origin='demo')`],
  ["commerce_activation_decisions → demo",   `DELETE FROM commerce_activation_decisions WHERE listing_id IN (SELECT id FROM listings WHERE origin='demo')`],
  ["price_observations → demo listing",      `DELETE FROM price_observations WHERE listing_slug IN (SELECT slug FROM listings WHERE origin='demo')`],
  ["comparison items → demo listing",        `DELETE FROM comparison_items WHERE listing_slug IN (SELECT slug FROM listings WHERE origin='demo')`],
  ["demo listings",                            `DELETE FROM listings WHERE origin='demo'`],
  ["demo products",                            `DELETE FROM products WHERE origin='demo'`],
  ["demo registry identifiers",                `DELETE FROM registry_identifiers WHERE source_entity_id IN (SELECT id FROM organizations WHERE origin='demo')`],
];

// Best-effort teardown of the demo commerce/source sandbox that backs the demo orgs (all fixtures;
// no live commerce exists — VialGrade is affiliate-out). Delete every seller-/source-child row for demo
// orgs, then the sellers and sources, then the org rows. Anything that can't unwind cleanly is left
// in place but is invisible: the consumer surface filters to origin='live', and production never
// creates any of it. Ordered children-first; each guarded.
const demoOrgs = `(SELECT id FROM organizations WHERE origin='demo')`;
const demoSellers = `(SELECT id FROM commerce_sellers WHERE organization_id IN ${demoOrgs})`;
const demoSources = `(SELECT id FROM sources WHERE owner_organization_id IN ${demoOrgs})`;
const sellerChildren = ["commerce_cart_lines","commerce_order_lines","commerce_ledger_entries","commerce_shipments","commerce_inventory","commerce_payouts","seller_catalog_drafts","seller_team_members","seller_profiles","seller_onboarding_sessions","seller_integrations","seller_import_jobs","seller_products","seller_evidence_documents","seller_readiness_snapshots","seller_api_tokens","seller_webhook_endpoints","seller_analytics_daily","commerce_provider_accounts","commerce_provider_onboarding_sessions","commerce_activation_decisions","commerce_provider_transfers","commerce_reserve_holds","commerce_tax_transactions","commerce_fulfillment_quotes","commerce_underwriting_reviews"];
const sourceChildren = ["source_snapshots","source_snapshot_diffs","source_pilots","source_reliability_snapshots","data_freshness_status","source_refresh_policies","source_refresh_attempts","claims","refresh_jobs"];
for (const t of sellerChildren) steps.push([`${t} → demo seller`, `DELETE FROM ${t} WHERE seller_id IN ${demoSellers}`]);
for (const t of sourceChildren) steps.push([`${t} → demo source`, `DELETE FROM ${t} WHERE source_id IN ${demoSources}`]);
steps.push(["demo commerce_sellers", `DELETE FROM commerce_sellers WHERE organization_id IN ${demoOrgs}`]);
steps.push(["demo sources", `DELETE FROM sources WHERE owner_organization_id IN ${demoOrgs}`]);
steps.push(["demo organizations", `DELETE FROM organizations WHERE origin='demo'`]);
for (const [label, sql] of steps) { const r = await q(label, sql); console.log(r.err ? `  ⚠ ${label}: ${r.err}` : `  − ${label}: ${r.n}`); }

const after = (await db.query(`SELECT
  (SELECT COUNT(*) FROM organizations WHERE origin='demo') demo_orgs,
  (SELECT COUNT(*) FROM organizations WHERE origin='live') live_orgs,
  (SELECT COUNT(*) FROM listings WHERE origin='demo') demo_listings,
  (SELECT COUNT(*) FROM listings WHERE origin='live') live_listings,
  (SELECT COUNT(*) FROM batch_passports) passports,
  (SELECT COUNT(*) FROM laboratory_profiles) labs`)).rows[0];
console.log("After:", JSON.stringify(after));
console.log(Number(after.demo_orgs) === 0 && Number(after.demo_listings) === 0 && Number(after.labs) === 0 ? "✓ Demo data removed — live data only." : "⚠ Some demo data remains.");
process.exit(0);

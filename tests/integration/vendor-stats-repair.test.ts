import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { QueryResultRow } from "pg";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { rebuildSearchIndex } from "@/server/search/engine";
import { getVendorReputationBySlug } from "@/server/reputation/repository";
import { getCatalogSnapshot } from "@/server/catalog/repository";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SESSION_SECRET = "vendor-stats-test-secret-at-least-32-characters";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "vendor-stats-privacy-secret-at-least-32-chars";

// organizations.product_count and organizations.documentation_current summarise a vendor's
// listings, but their only writer was the publication cascade, which live catalog imports never
// enter. Stored SUM(product_count) was 15 against 580 real listings, and the only rows left holding
// a non-zero value were the six seeded FICTIONAL companies — which is what site search ranks on.
describe("vendor stats stay tied to the listings they summarise", () => {
  beforeAll(async () => { await resetDatabaseForTests(); await getDatabase(); });
  afterAll(async () => { await resetDatabaseForTests(); });

  it("stores no vendor count that its own listings do not support", async () => {
    const db = await getDatabase();
    const drifted = (await db.query<QueryResultRow & { slug: string; stored_count: number; real_count: number; stored_docs: number; real_docs: number }>(`
      SELECT o.slug,
             o.product_count::int stored_count,
             o.documentation_current::int stored_docs,
             (SELECT COUNT(*) FROM listings l JOIN products p ON p.id=l.product_id
               WHERE p.vendor_id=o.id AND p.status='active')::int real_count,
             (SELECT COUNT(*) FROM listings l JOIN products p ON p.id=l.product_id
               WHERE p.vendor_id=o.id AND p.status='active'
                 AND l.report_date IS NOT NULL AND l.report_date <> '' AND l.report_date <> 'Not located')::int real_docs
        FROM organizations o WHERE o.organization_type='vendor'
    `)).rows.filter(r => Number(r.stored_count) !== Number(r.real_count) || Number(r.stored_docs) !== Number(r.real_docs));
    expect(drifted).toEqual([]);
  });

  it("never stores more documented listings than listings", async () => {
    const db = await getDatabase();
    const impossible = (await db.query<QueryResultRow & { n: number }>(
      `SELECT COUNT(*)::int n FROM organizations WHERE organization_type='vendor' AND documentation_current > product_count`,
    )).rows[0];
    expect(Number(impossible.n)).toBe(0);
  });

  it("ranks a real vendor's catalog above a fictional one in the search index", async () => {
    const db = await getDatabase();
    // A live catalog import: organization, products and listings written directly, exactly as
    // shopify-import/woocommerce-import write them. Nothing here enters the publication cascade.
    await db.query(
      `INSERT INTO organizations (id,slug,organization_type,display_name,description,location,founded,initials,profile_status,participation_status,origin)
       VALUES ('org:driftcheck-labs','driftcheck-labs','vendor','Driftcheck Labs','An imported storefront','','','DL','unclaimed','independent','live')
       ON CONFLICT (slug) DO NOTHING`,
    );
    const compound = (await db.query<QueryResultRow & { id: string }>(`SELECT id FROM compounds LIMIT 1`)).rows[0];
    for (let i = 0; i < 20; i += 1) {
      await db.query(
        `INSERT INTO products (id,slug,vendor_id,compound_id,name,declared_quantity,declared_form,status)
         VALUES ($1,$2,'org:driftcheck-labs',$3,$4,'10mg','lyophilized','active') ON CONFLICT (slug) DO NOTHING`,
        [`prd:driftcheck-${i}`, `driftcheck-${i}`, compound.id, `Driftcheck item ${i}`],
      );
      await db.query(
        `INSERT INTO listings (id,slug,product_id,price,currency,availability,shipping_claim,evidence_level,evidence_label,report_date,report_issuer,report_confirmed,batch_code,batch_linked,sample_origin,last_checked,rating,review_count,featured,checkout_mode,origin)
         VALUES ($1,$2,$3,49.00,'USD','in-stock','','public-only','Vendor catalog','','',FALSE,'',FALSE,'','just now',0,0,FALSE,'external','live')
         ON CONFLICT (slug) DO NOTHING`,
        [`lst:driftcheck-${i}`, `driftcheck-${i}`, `prd:driftcheck-${i}`],
      );
    }

    // The collect tick recomputes derived catalog stats before rebuilding the index; do the same.
    const { recomputeVendorStats } = await import("@/server/db/vendor-stats-repair");
    await recomputeVendorStats(db);
    await rebuildSearchIndex(db);

    const scores = Object.fromEntries((await db.query<QueryResultRow & { entity_id: string; popularity_score: string; quality_score: string }>(
      `SELECT entity_id,popularity_score,quality_score FROM search_documents WHERE entity_type='organization'`,
    )).rows.map(r => [r.entity_id, { popularity: Number(r.popularity_score), quality: Number(r.quality_score) }]));

    // 20 real listings must outweigh a fictional company with 3.
    expect(scores["org:driftcheck-labs"].popularity).toBe(20 * 8);
    expect(scores["org:driftcheck-labs"].popularity).toBeGreaterThan(scores["org:northstar-research"].popularity);
    // And the quality term stops being a percentage-shaped number no live vendor can ever reach.
    expect(scores["org:northstar-research"].quality).toBeLessThanOrEqual(scores["org:northstar-research"].popularity / 8);
  });

  it("counts only active products in the listing total a vendor page renders", async () => {
    const db = await getDatabase();
    await db.query(`UPDATE products SET status='retired' WHERE id='prd:driftcheck-0'`);
    const { recomputeVendorStats } = await import("@/server/db/vendor-stats-repair");
    await recomputeVendorStats(db);

    const snapshot = await getCatalogSnapshot();
    const vendor = snapshot.vendors.find(v => v.slug === "driftcheck-labs");
    expect(vendor?.productCount).toBe(19);
    const stored = (await db.query<QueryResultRow & { product_count: number }>(
      `SELECT product_count::int FROM organizations WHERE slug='driftcheck-labs'`,
    )).rows[0];
    expect(Number(stored.product_count)).toBe(19);
  });

  it("reports documentation as a count with its denominator, never as a percentage", async () => {
    const record = await getVendorReputationBySlug("northstar-research");
    const dimension = record!.dimensions.find(d => d.key === "documentation_currency")!;
    expect(dimension.value).not.toMatch(/%/);
    expect(dimension.value).toMatch(/^\d+ of \d+ listings? show a dated lab report$/);

    const db = await getDatabase();
    const real = (await db.query<QueryResultRow & { documented: number; total: number }>(`
      SELECT (SELECT COUNT(*) FROM listings l JOIN products p ON p.id=l.product_id
               WHERE p.vendor_id='org:northstar-research' AND p.status='active'
                 AND l.report_date IS NOT NULL AND l.report_date <> '' AND l.report_date <> 'Not located')::int documented,
             (SELECT COUNT(*) FROM listings l JOIN products p ON p.id=l.product_id
               WHERE p.vendor_id='org:northstar-research' AND p.status='active')::int total
    `)).rows[0];
    expect(dimension.value).toBe(`${real.documented} of ${real.total} listings show a dated lab report`);
    expect(dimension.numericValue).toBe(Number(real.documented));
  });

  it("converges: a second recompute changes nothing", async () => {
    const db = await getDatabase();
    const before = (await db.query(`SELECT slug,product_count,documentation_current FROM organizations WHERE organization_type='vendor' ORDER BY slug`)).rows;
    const { recomputeVendorStats } = await import("@/server/db/vendor-stats-repair");
    await recomputeVendorStats(db);
    const after = (await db.query(`SELECT slug,product_count,documentation_current FROM organizations WHERE organization_type='vendor' ORDER BY slug`)).rows;
    expect(after).toEqual(before);
  });
});

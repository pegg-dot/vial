import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.VIALGRADE_PGLITE_MEMORY = "true";

// Phase 0 of docs/superpowers/specs/2026-08-29-vial-price-truth-design.md, proven as one
// source-to-signal trace in both polarities. On 2026-08-29 production served $100 for 75
// umbrella-labs listings because the daily page scrape read "ORDERS $100 OR MORE" as the price,
// auto-triage approved it, and the cascade pushed "$79.99 → $100" to watchers. The hourly
// collector, which reads the vendor's own structured feed, had the true price all along.

type Modules = {
  runSourceIngestion: typeof import("@/server/agents/pipeline").runSourceIngestion;
  triagePendingClaims: typeof import("@/server/refresh/auto-triage").triagePendingClaims;
  getPendingClaims: typeof import("@/server/review/repository").getPendingClaims;
  getPublicationRecords: typeof import("@/server/review/repository").getPublicationRecords;
  getProductBySlug: typeof import("@/server/catalog/repository").getProductBySlug;
  getAlertsForListingSlugs: typeof import("@/server/intelligence/repository").getAlertsForListingSlugs;
  getDatabase: typeof import("@/server/db/client").getDatabase;
};

const slug = "feed-vendor-bpc-157-5mg";
const url = "https://feed-vendor.example/products/bpc-157-5mg";
const target = "ct:catalog-woo:feed-vendor";

describe("price authority: a scraped page cannot overrule a fresh catalogue feed", () => {
  let m: Modules;

  beforeAll(async () => {
    (globalThis as typeof globalThis & { __vialDbPromise?: unknown }).__vialDbPromise = undefined;
    const [pipeline, triage, review, catalog, intelligence, database, live] = await Promise.all([
      import("@/server/agents/pipeline"),
      import("@/server/refresh/auto-triage"),
      import("@/server/review/repository"),
      import("@/server/catalog/repository"),
      import("@/server/intelligence/repository"),
      import("@/server/db/client"),
      import("@/server/ingest/live-sources"),
    ]);
    m = {
      runSourceIngestion: pipeline.runSourceIngestion,
      triagePendingClaims: triage.triagePendingClaims,
      getPendingClaims: review.getPendingClaims,
      getPublicationRecords: review.getPublicationRecords,
      getProductBySlug: catalog.getProductBySlug,
      getAlertsForListingSlugs: intelligence.getAlertsForListingSlugs,
      getDatabase: database.getDatabase,
    };
    const db = await m.getDatabase();
    await live.upsertLiveVendor(db, { slug: "feed-vendor", name: "Feed Vendor", domains: ["feed-vendor.example"], description: "fixture" });
    // The collector's write: the vendor's structured feed says $34.95.
    await live.recordCatalogListing(db, {
      compoundSlug: "bpc-157", vendorSlug: "feed-vendor", slug, name: "BPC-157 5 mg", quantity: "5mg",
      externalUrl: url, price: 34.95, availability: "In stock", sourceUrl: url, sourceLabel: "Feed Vendor BPC-157",
    });
    // …and the collector's receipt: the catalogue feed was read successfully just now.
    await db.query(
      `INSERT INTO collection_targets (id, collector, target, cadence_minutes, last_ok, last_run_at)
       VALUES ($1, 'catalog-woo', 'feed-vendor', 360, TRUE, NOW())`,
      [target],
    );
  });

  afterAll(async () => {
    const db = await m.getDatabase();
    await db.close();
    (globalThis as typeof globalThis & { __vialDbPromise?: unknown }).__vialDbPromise = undefined;
  });

  const scrape = (body: string, head = "") => m.runSourceIngestion({
    sourceType: "vendor-page",
    canonicalLocation: url,
    label: "Feed Vendor product page",
    targetListingSlug: slug,
    rawContent: `<html><head>${head}</head><body>${body}</body></html>`,
    contentType: "text/html",
    actor: "test:price-authority",
  });
  const price = async () => (await m.getProductBySlug(slug))?.price;
  const priceClaimOf = async (runId: string) => (await m.getPendingClaims()).find((claim) => claim.runId === runId && claim.predicate === "price");
  const priceAlerts = async () => (await m.getAlertsForListingSlugs([slug])).filter((alert) => alert.category === "price-change");
  const publications = async () => (await m.getPublicationRecords()).filter((record) => record.listingSlug === slug);

  it("proposes no price from a multi-variant page whose only bare dollar figure is a shipping banner", async () => {
    // Before the fix this page yielded a $150 claim — the exact [34.95, 150, 150] history in production.
    const run = await scrape(
      `<div class="announcement">Free shipping on orders over $150</div><h1>BPC-157</h1>`,
      `<script type="application/ld+json">{"@type":"Product","offers":[{"price":"34.95"},{"price":"59.95"}]}</script>`,
    );
    expect(run.changedPredicates).not.toContain("price");
    expect(await price()).toBe(34.95);
  });

  it("rejects a labeled scraped price while the feed is fresh — with a receipt, no publication, no alert", async () => {
    const run = await scrape(`<h1>BPC-157 5 mg</h1><p>Price: $150.00</p>`);
    // Positive control: the pipeline still proposes the claim and still rates the move material.
    expect(run.changedPredicates).toContain("price");
    const claim = await priceClaimOf(run.runId);
    expect(claim?.riskLevel).toBe("material");
    if (!claim) throw new Error("expected a pending price claim");

    const outcome = await m.triagePendingClaims(await m.getDatabase());
    const rejected = outcome.rejected.find((entry) => entry.claimId === claim.id);
    expect(rejected?.reason).toMatch(/catalogue feed/i);
    expect(outcome.approved.map((entry) => entry.claimId)).not.toContain(claim.id);

    expect(await price()).toBe(34.95);
    expect(await publications()).toHaveLength(0);
    expect(await priceAlerts()).toHaveLength(0);
    const db = await m.getDatabase();
    const decision = await db.query(`SELECT * FROM review_decisions WHERE claim_id = $1`, [claim.id]);
    expect(decision.rows).toHaveLength(1);
    expect(JSON.stringify(decision.rows[0])).toMatch(/Superseded/);
  });

  it("holds a material scraped move for a person once the feed is stale", async () => {
    const db = await m.getDatabase();
    await db.query(`UPDATE collection_targets SET last_run_at = NOW() - INTERVAL '3 days' WHERE id = $1`, [target]);
    const run = await scrape(`<h1>BPC-157 5 mg</h1><p>Sale price: $150.00</p>`);
    const claim = await priceClaimOf(run.runId);
    expect(claim?.riskLevel).toBe("material");
    if (!claim) throw new Error("expected a pending price claim");

    const outcome = await m.triagePendingClaims(db);
    expect(outcome.held.find((entry) => entry.claimId === claim.id)?.reason).toMatch(/material/i);
    expect(await price()).toBe(34.95);
    expect(await priceAlerts()).toHaveLength(0);
  });

  it("publishes a routine scraped move once the feed is stale — the scrape is the fallback", async () => {
    const run = await scrape(`<h1>BPC-157 5 mg</h1><p>Price: $39.95</p>`);
    const claim = await priceClaimOf(run.runId);
    expect(claim?.riskLevel).toBe("standard");
    if (!claim) throw new Error("expected a pending price claim");

    const outcome = await m.triagePendingClaims(await m.getDatabase());
    expect(outcome.approved.map((entry) => entry.claimId)).toContain(claim.id);
    expect(await price()).toBe(39.95);
    const records = await publications();
    expect(records).toHaveLength(1);
    expect(records[0].after.price).toBe(39.95);
    expect(await priceAlerts()).toHaveLength(1);
  });
});

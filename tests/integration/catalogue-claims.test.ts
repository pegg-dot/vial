import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { runCollectionTick, syncCollectionTargets } from "@/server/collect/scheduler";
import { getPublicationRecords } from "@/server/review/repository";
import { getAlertsForListingSlugs } from "@/server/intelligence/repository";

// Phase 3 of docs/superpowers/specs/2026-08-29-vial-price-truth-design.md. AGENTS.md: every changed
// observed value enters the review queue; every approved mutation creates a publication receipt in
// the same transaction. The collector had been overwriting listings.price directly — the only
// price writer with no receipt, no cascade, and therefore no truthful price alert.

beforeEach(async () => {
  process.env.VIALGRADE_PGLITE_MEMORY = "true";
  process.env.VIALGRADE_SEED_FIXTURES = "true";
  process.env.VIALGRADE_SEED_DEMO_ACCOUNTS = "true";
  delete (globalThis as { __vialEvidenceSeedPromise?: unknown }).__vialEvidenceSeedPromise;
  delete (globalThis as { __vialSellerOpsSeedPromise?: unknown }).__vialSellerOpsSeedPromise;
  await resetDatabaseForTests();
});
afterEach(() => vi.unstubAllGlobals());

const bluum = "ct:catalog-shopify:bluum-peptides";
const feed = (products: { title: string; handle: string; price: string }[]) =>
  ({ products: products.map((p) => ({ title: p.title, handle: p.handle, variants: [{ title: "Default Title", price: p.price, available: true }] })) });
function stubShopify(body: unknown) {
  vi.stubGlobal("fetch", (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch);
}
async function tick(db: Awaited<ReturnType<typeof getDatabase>>) {
  await syncCollectionTargets(db);
  await db.query(`UPDATE collection_targets SET next_due_at = NOW() + interval '1 day'`);
  await db.query(`UPDATE collection_targets SET next_due_at = NOW() - interval '1 hour', enabled = TRUE, consecutive_failures = 0 WHERE id = $1`, [bluum]);
  return runCollectionTick({ budgetMs: 8_000, maxTargets: 1, connection: db });
}
const listing = async (db: Awaited<ReturnType<typeof getDatabase>>, slug: string) =>
  (await db.query<{ price: string; previous_price: string | null; price_source: string }>(`SELECT price, previous_price, price_source FROM listings WHERE slug = $1`, [slug])).rows[0];
const claims = async (db: Awaited<ReturnType<typeof getDatabase>>, slug: string) =>
  (await db.query<{ predicate: string; review_status: string; value_json: unknown; extractor_version: string; risk_level: string }>(
    `SELECT ec.predicate, ec.review_status, ec.value_json, ec.extractor_version, ec.risk_level FROM evidence_claims ec JOIN listings l ON l.id = ec.subject_id WHERE l.slug = $1 ORDER BY ec.created_at`, [slug])).rows;
const priceAlerts = async (slug: string) => (await getAlertsForListingSlugs([slug])).filter((a) => a.category === "price-change");
const publications = async (slug: string) => (await getPublicationRecords()).filter((r) => r.listingSlug === slug);
const bpc = "bluum-peptides-bpc-157";

describe("a changed feed price goes through the claim path", () => {
  it("the first read of a listing sets its price directly — creation is not a change (control)", async () => {
    const db = await getDatabase();
    stubShopify(feed([{ title: "BPC-157 5mg", handle: "bpc", price: "34.95" }]));
    await tick(db);
    expect((await listing(db, bpc)).price).toBe("34.95");
    expect(await claims(db, bpc)).toHaveLength(0);
    expect(await publications(bpc)).toHaveLength(0);
    expect(await priceAlerts(bpc)).toHaveLength(0);
  });

  it("a changed price on the next read becomes one published claim, one receipt, one alert", async () => {
    // Fails while the collector overwrites listings.price with no claim.
    const db = await getDatabase();
    stubShopify(feed([{ title: "BPC-157 5mg", handle: "bpc", price: "34.95" }]));
    await tick(db);
    stubShopify(feed([{ title: "BPC-157 5mg", handle: "bpc", price: "29.95" }]));
    await tick(db);
    const row = await listing(db, bpc);
    expect(row).toMatchObject({ price: "29.95", previous_price: "34.95", price_source: "catalogue" });
    const found = await claims(db, bpc);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ predicate: "price", review_status: "published", extractor_version: "catalogue-feed" });
    const records = await publications(bpc);
    expect(records).toHaveLength(1);
    expect(records[0].after.price).toBe(29.95);
    expect(await priceAlerts(bpc)).toHaveLength(1);
  });

  it("an unchanged price on the next read creates nothing (control)", async () => {
    const db = await getDatabase();
    stubShopify(feed([{ title: "BPC-157 5mg", handle: "bpc", price: "34.95" }]));
    await tick(db);
    await tick(db);
    expect(await claims(db, bpc)).toHaveLength(0);
  });

  it("holds every price when most of a vendor's catalogue lands on one new price in a single read", async () => {
    // Fails if a broken feed (every product "$99") can publish itself — the vendor-wide signature.
    const db = await getDatabase();
    const names = ["BPC-157", "KPV", "MOTS-c", "GHK-Cu", "Semax", "Epitalon"];
    const distinct = names.flatMap((n, i) => [{ title: `${n} 5mg`, handle: `${n}-5`, price: String(20 + i * 7) }, { title: `${n} 10mg`, handle: `${n}-10`, price: String(35 + i * 7) }]);
    stubShopify(feed(distinct));
    const first = await tick(db);
    expect(first.ran.find((r) => r.target === "bluum-peptides")?.items).toBeGreaterThanOrEqual(10);
    stubShopify(feed(distinct.map((p) => ({ ...p, price: "99" }))));
    await tick(db);
    expect(Number((await listing(db, bpc)).price)).toBe(20);
    const held = (await db.query<{ n: string }>(`SELECT COUNT(*) AS n FROM evidence_claims WHERE extractor_version = 'catalogue-feed' AND review_status = 'pending'`)).rows[0];
    expect(Number(held.n)).toBeGreaterThanOrEqual(10);
    expect(await priceAlerts(bpc)).toHaveLength(0);
  });

  it("holds a move beyond five-fold for a person", async () => {
    // Fails if any feed value publishes regardless of size.
    const db = await getDatabase();
    stubShopify(feed([{ title: "BPC-157 5mg", handle: "bpc", price: "34.95" }]));
    await tick(db);
    stubShopify(feed([{ title: "BPC-157 5mg", handle: "bpc", price: "200" }]));
    await tick(db);
    expect((await listing(db, bpc)).price).toBe("34.95");
    const found = await claims(db, bpc);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ review_status: "pending", risk_level: "material" });
  });
});

describe("an approval no longer zeroes a basis-derived compound Δ", () => {
  it("keeps price_change where the tick put it when a claim publishes", async () => {
    // Fails while cascade.recomputeCompound recomputes price_change from the (now empty) arrays.
    const db = await getDatabase();
    const live = await import("@/server/ingest/live-sources");
    const { runSourceIngestion } = await import("@/server/agents/pipeline");
    const { triagePendingClaims } = await import("@/server/refresh/auto-triage");
    const url = "https://stale-vendor.example/p/bpc";
    await live.upsertLiveVendor(db, { slug: "stale-vendor", name: "Stale Vendor", domains: ["stale-vendor.example"], description: "fixture" });
    await live.recordCatalogListing(db, { compoundSlug: "bpc-157", vendorSlug: "stale-vendor", slug: "stale-vendor-bpc-157", name: "BPC-157 5 mg", quantity: "5mg", externalUrl: url, price: 34.95, availability: "In stock", sourceUrl: url, sourceLabel: "Stale" });
    await db.query(`UPDATE compounds SET price_change = -2.4, price_change_basis = '{"k":3,"n":3,"window":30,"asOf":"2026-08-29T00:00:00Z","medianPct":-2.4}'::jsonb WHERE slug = 'bpc-157'`);
    // No fresh feed for this vendor, so the scraped price is the fallback and publishes.
    await runSourceIngestion({ sourceType: "vendor-page", canonicalLocation: url, label: "Stale Vendor page", targetListingSlug: "stale-vendor-bpc-157", rawContent: `<html><body><h1>BPC-157</h1><p>Price: $39.95</p></body></html>`, contentType: "text/html", actor: "test:phase3" });
    const outcome = await triagePendingClaims(db);
    expect(outcome.approved.length).toBe(1);
    const compound = (await db.query<{ price_change: string }>(`SELECT price_change FROM compounds WHERE slug = 'bpc-157'`)).rows[0];
    expect(Number(compound.price_change)).toBe(-2.4);
  });
});

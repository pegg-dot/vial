import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { runCollectionTick, syncCollectionTargets } from "@/server/collect/scheduler";
import { getListingPriceSeries, getCompoundPriceBasis, recomputeCompoundPriceChanges } from "@/server/ingest/price-history";

// Phase 2 of docs/superpowers/specs/2026-08-29-vial-price-truth-design.md — observations are the
// substrate (D4). One row per listing per UTC day, written by ONE statement at the end of the
// collect tick, carrying the true source and availability. Never for demo listings.

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
const feed = (products: { title: string; handle: string; price: string; available?: boolean }[]) =>
  ({ products: products.map((p) => ({ title: p.title, handle: p.handle, variants: [{ title: "Default Title", price: p.price, available: p.available ?? true }] })) });
function stubShopify(body: unknown) {
  vi.stubGlobal("fetch", (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch);
}
async function tick(db: Awaited<ReturnType<typeof getDatabase>>) {
  await syncCollectionTargets(db);
  await db.query(`UPDATE collection_targets SET next_due_at = NOW() + interval '1 day'`);
  await db.query(`UPDATE collection_targets SET next_due_at = NOW() - interval '1 hour', enabled = TRUE, consecutive_failures = 0 WHERE id = $1`, [bluum]);
  return runCollectionTick({ budgetMs: 8_000, maxTargets: 1, connection: db });
}
const observations = async (db: Awaited<ReturnType<typeof getDatabase>>, slug: string) =>
  (await db.query<{ observed_day: string; price: string | null; available: boolean; source: string; id: string }>(
    `SELECT id, observed_day::text AS observed_day, price, available, source FROM price_observations WHERE listing_slug = $1 ORDER BY observed_day`, [slug])).rows;

describe("the collect tick records one observation per live listing it touched", () => {
  it("writes today's row with the feed price, availability and source, and never for demo listings", async () => {
    // Fails if the tick does not write observations (today: no src/ caller of recordPriceObservation).
    const db = await getDatabase();
    stubShopify(feed([{ title: "BPC-157 5mg", handle: "bpc", price: "34.95" }, { title: "Epitalon 10mg", handle: "epi", price: "48.00", available: false }]));
    const result = await tick(db);
    expect(result.ran.find((r) => r.target === "bluum-peptides")?.ok).toBe(true);
    const bpc = await observations(db, "bluum-peptides-bpc-157");
    expect(bpc).toHaveLength(1);
    expect(bpc[0]).toMatchObject({ price: "34.95", available: true, source: "catalogue" });
    expect(bpc[0].id).toMatch(/^priceobs:bluum-peptides-bpc-157:\d{8}$/);
    const epi = await observations(db, "bluum-peptides-epitalon");
    expect(epi[0]).toMatchObject({ price: "48.00", available: false });
    const demo = await db.query<{ n: string }>(`SELECT COUNT(*) AS n FROM price_observations o JOIN listings l ON l.slug = o.listing_slug WHERE l.origin <> 'live' AND o.source <> 'demo'`);
    expect(Number(demo.rows[0].n)).toBe(0);
  });

  it("re-running the tick the same day updates the row instead of adding one, last check wins", async () => {
    // Fails if the write is not keyed on (listing, UTC day) with DO UPDATE.
    const db = await getDatabase();
    stubShopify(feed([{ title: "BPC-157 5mg", handle: "bpc", price: "34.95" }]));
    await tick(db);
    stubShopify(feed([{ title: "BPC-157 5mg", handle: "bpc", price: "29.95" }]));
    await tick(db);
    const rows = await observations(db, "bluum-peptides-bpc-157");
    expect(rows).toHaveLength(1);
    expect(rows[0].price).toBe("29.95");
  });

  it("records a listing the feed no longer carries as unavailable on the day it was retired", async () => {
    // Fails if retirement does not bump observed_at (the tick statement keys on it).
    const db = await getDatabase();
    stubShopify(feed([{ title: "BPC-157 5mg", handle: "bpc", price: "34.95" }, { title: "Epitalon 10mg", handle: "epi", price: "48.00" }]));
    await tick(db);
    stubShopify(feed([{ title: "BPC-157 5mg", handle: "bpc", price: "34.95" }]));
    await tick(db);
    const epi = await observations(db, "bluum-peptides-epitalon");
    expect(epi.at(-1)).toMatchObject({ available: false });
  });
});

describe("a listing's series is its change points, dated", () => {
  async function seed(db: Awaited<ReturnType<typeof getDatabase>>, slug: string, points: { daysAgo: number; price: number | null; available?: boolean }[]) {
    for (const p of points) {
      await db.query(
        `INSERT INTO price_observations (id, listing_slug, vendor_slug, compound_slug, price, source, observed_day, observed_at, available)
         VALUES ($1, $2, 'v', 'bpc-157', $3, 'live', CURRENT_DATE - $4::int, NOW() - ($4::text || ' days')::interval, $5)`,
        [`priceobs:${slug}:${p.daysAgo}`, slug, p.price, p.daysAgo, p.available ?? p.price !== null],
      );
    }
  }

  it("keeps the first point, every change, and the latest, and nothing in between", async () => {
    // Fails if the series is every row (flat runs would swamp a sparkline) or only the latest.
    const db = await getDatabase();
    await seed(db, "s1", [{ daysAgo: 9, price: 34.95 }, { daysAgo: 8, price: 34.95 }, { daysAgo: 7, price: 29.95 }, { daysAgo: 6, price: 29.95 }, { daysAgo: 5, price: null, available: false }, { daysAgo: 4, price: 29.95 }, { daysAgo: 3, price: 29.95 }, { daysAgo: 0, price: 29.95 }]);
    const series = await getListingPriceSeries(db, ["s1"]);
    expect(series.get("s1")?.map((p) => [p.day, p.price, p.available])).toEqual([
      [expect.any(String), 34.95, true], [expect.any(String), 29.95, true], [expect.any(String), null, false], [expect.any(String), 29.95, true], [expect.any(String), 29.95, true],
    ]);
  });
});

describe("a compound's change is the median of listings that earned one (D6)", () => {
  async function seedFlat(db: Awaited<ReturnType<typeof getDatabase>>, slug: string, days: number, startPrice: number, endPrice: number, changeAtDaysAgo: number) {
    for (let d = days; d >= 0; d--) {
      await db.query(
        `INSERT INTO price_observations (id, listing_slug, vendor_slug, compound_slug, price, source, observed_day, observed_at)
         VALUES ($1, $2, 'v', 'bpc-157', $3, 'live', CURRENT_DATE - $4::int, NOW() - ($4::text || ' days')::interval)`,
        [`priceobs:${slug}:${d}`, slug, d > changeAtDaysAgo ? startPrice : endPrice, d],
      );
    }
  }

  it("withholds the median until three listings qualify, and prints k of n", async () => {
    // Fails if price_change is computed from two-point arrays with no window or minimum.
    const db = await getDatabase();
    // The fixture seed gives demo listings their own dated trail; this test is about the rule, so
    // it works from its synthetic rows only.
    await db.query(`DELETE FROM price_observations WHERE source = 'demo'`);
    await seedFlat(db, "l1", 40, 40, 36, 12);   // -10 % over the window
    await seedFlat(db, "l2", 40, 50, 50, 12);   // 0 %
    await seedFlat(db, "l3", 5, 30, 30, 2);     // too short a span
    await recomputeCompoundPriceChanges(db);
    let basis = await getCompoundPriceBasis(db, "bpc-157");
    expect(basis).toMatchObject({ k: 2, n: 3, window: 30 });
    expect(basis?.medianPct).toBeNull();

    await seedFlat(db, "l4", 40, 20, 19, 12);   // -5 %
    await recomputeCompoundPriceChanges(db);
    basis = await getCompoundPriceBasis(db, "bpc-157");
    expect(basis).toMatchObject({ k: 3, n: 4 });
    expect(basis?.medianPct).toBe(-5);
    const stored = await db.query<{ price_change: string }>(`SELECT price_change FROM compounds WHERE slug = 'bpc-157'`);
    expect(Number(stored.rows[0].price_change)).toBe(-5);
  });
});

describe("migration 53 resets the undated arrays and seeds one real observation per live listing (D5)", () => {
  it("repairs a production-shaped database in place, and only the live rows", async () => {
    // Fails if the repair is missing, seeds from the deploy day instead of the day the price was
    // actually observed, touches demo listings, or leaves previous_price / price_change behind.
    const db = await getDatabase();
    const live = await import("@/server/ingest/live-sources");
    const { runMigrations } = await import("@/server/db/migrations");
    await live.upsertLiveVendor(db, { slug: "junk-vendor", name: "Junk Vendor", domains: ["junk.example"], description: "fixture" });
    await live.recordCatalogListing(db, {
      compoundSlug: "bpc-157", vendorSlug: "junk-vendor", slug: "junk-vendor-bpc-157", name: "BPC-157 5 mg", quantity: "5mg",
      externalUrl: "https://junk.example/p", price: 34.95, availability: "In stock", sourceUrl: "https://junk.example/p", sourceLabel: "Junk",
    });
    // Production shape on 2026-08-29: a banner history, a previous_price from a junk approval,
    // a price last observed three days ago, and a compound Δ of +525 %.
    await db.query(`UPDATE listings SET price_history = '[34.95,150,150]'::jsonb, previous_price = 150, observed_at = NOW() - INTERVAL '3 days' WHERE slug = 'junk-vendor-bpc-157'`);
    await db.query(`UPDATE compounds SET price_change = 525.3 WHERE slug = 'bpc-157'`);
    await db.query(`DELETE FROM price_observations`);
    const demoBefore = (await db.query<{ price_history: unknown }>(`SELECT price_history FROM listings WHERE origin <> 'live' AND jsonb_array_length(price_history) > 1 LIMIT 1`)).rows[0];
    expect(demoBefore).toBeTruthy();

    await db.query(`DELETE FROM schema_migrations WHERE version = 53`);
    await runMigrations(db);

    const obs = (await db.query<{ observed_day: string; price: string; available: boolean; source: string; days_ago: number }>(
      `SELECT observed_day::text AS observed_day, price, available, source, ((NOW() AT TIME ZONE 'UTC')::date - observed_day) AS days_ago FROM price_observations WHERE listing_slug = 'junk-vendor-bpc-157'`)).rows;
    expect(obs).toHaveLength(1);
    expect(obs[0]).toMatchObject({ price: "34.95", available: true, source: "catalogue" });
    expect(Number(obs[0].days_ago)).toBe(3);
    const listing = (await db.query<{ price_history: unknown; previous_price: string | null }>(`SELECT price_history, previous_price FROM listings WHERE slug = 'junk-vendor-bpc-157'`)).rows[0];
    expect(listing.price_history).toEqual([]);
    expect(listing.previous_price).toBeNull();
    const compound = (await db.query<{ price_change: string; price_change_basis: { k: number; n: number; medianPct: number | null } }>(`SELECT price_change, price_change_basis FROM compounds WHERE slug = 'bpc-157'`)).rows[0];
    expect(Number(compound.price_change)).toBe(0);
    // The basis is populated immediately (k of n, nothing earned), never left empty.
    expect(compound.price_change_basis).toMatchObject({ k: 0, medianPct: null });
    expect(compound.price_change_basis.n).toBeGreaterThanOrEqual(1);
    // The repair writes nothing for demo listings (the seed's own demo trail was deleted above).
    const demoObs = (await db.query<{ n: string }>(`SELECT COUNT(*) AS n FROM price_observations o JOIN listings l ON l.slug = o.listing_slug WHERE l.origin <> 'live'`)).rows[0];
    expect(Number(demoObs.n)).toBe(0);
  });
});

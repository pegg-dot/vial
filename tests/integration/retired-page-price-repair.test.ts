import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { CURRENT_SCHEMA_VERSION } from "@/server/db/migrations";
import { repairRetiredPagePrices } from "@/server/db/retired-page-price-repair";
import { runCollectionTick, syncCollectionTargets } from "@/server/collect/scheduler";
import { runSourceIngestion } from "@/server/agents/pipeline";
import { reviewClaim } from "@/server/review/repository";
import { recomputeCompoundStats, recordCatalogListing, upsertLiveVendor } from "@/server/ingest/live-sources";
import { recordTickPriceObservations } from "@/server/ingest/price-history";

// Migration 55 and the current-offer median. A listing the feed no longer carries cannot have a
// scraped price corrected by the feed, so it kept the promo banner it was scraped from as its
// price; and that number kept ranking in its compound's median. What a price-comparison site
// shows for a delisted offer is its last known real price, and it never counts toward "cheapest".

beforeEach(async () => {
  process.env.VIALGRADE_PGLITE_MEMORY = "true";
  process.env.VIALGRADE_SEED_FIXTURES = "true";
  process.env.VIALGRADE_SEED_DEMO_ACCOUNTS = "true";
  delete (globalThis as { __vialEvidenceSeedPromise?: unknown }).__vialEvidenceSeedPromise;
  delete (globalThis as { __vialSellerOpsSeedPromise?: unknown }).__vialSellerOpsSeedPromise;
  await resetDatabaseForTests();
});
afterEach(() => vi.unstubAllGlobals());

type Db = Awaited<ReturnType<typeof getDatabase>>;
const bluum = "ct:catalog-shopify:bluum-peptides";
const feed = (items: { title: string; handle: string; price: string }[]) =>
  ({ products: items.map((p) => ({ title: p.title, handle: p.handle, variants: [{ title: "Default Title", price: p.price, available: true }] })) });
function stubShopify(body: unknown) {
  vi.stubGlobal("fetch", (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch);
}
async function tick(db: Db) {
  await syncCollectionTargets(db);
  await db.query(`UPDATE collection_targets SET next_due_at = NOW() + interval '1 day'`);
  await db.query(`UPDATE collection_targets SET next_due_at = NOW() - interval '1 hour', enabled = TRUE, consecutive_failures = 0 WHERE id = $1`, [bluum]);
  return runCollectionTick({ budgetMs: 8_000, maxTargets: 1, connection: db });
}
const listing = async (db: Db, slug: string) =>
  (await db.query<{ id: string; price: string; price_source: string; availability: string; external_url: string }>(`SELECT id, price, price_source, availability, external_url FROM listings WHERE slug = $1`, [slug])).rows[0]!;
const observations = async (db: Db, slug: string) =>
  (await db.query<{ price: string; source: string; available: boolean }>(`SELECT price, source, available FROM price_observations WHERE listing_slug = $1 ORDER BY observed_day`, [slug])).rows;
const median = async (db: Db, compound: string) => Number((await db.query<{ median_price: string }>(`SELECT median_price FROM compounds WHERE slug = $1`, [compound])).rows[0]!.median_price);

/** A person approves a page-scrape price — the real writer of a 'page' price, with its receipt. */
async function approvePagePrice(db: Db, slug: string, price: string) {
  const row = await listing(db, slug);
  await runSourceIngestion({
    sourceType: "vendor-page", canonicalLocation: row.external_url, label: "Bluum product page", targetListingSlug: slug,
    rawContent: `<html><body><h1>${slug}</h1><p>Price: $${price}</p><p>Orders over $150 ship free.</p></body></html>`, contentType: "text/html", actor: "test:migration-55",
  });
  const pending = (await db.query<{ id: string }>(`SELECT id FROM evidence_claims WHERE subject_id = $1 AND predicate = 'price' AND review_status = 'pending' ORDER BY created_at DESC LIMIT 1`, [row.id])).rows[0];
  expect(pending, `a pending page price claim for $${price}`).toBeTruthy();
  await reviewClaim({ claimId: pending!.id, decision: "approve", actor: "test:person", role: "admin", notes: "test" });
}

const bpc = "bluum-peptides-bpc-157";

describe("migration 55 restores a delisted listing's last feed price from the receipt", () => {
  it("is registered as a migration that every fresh database applies", async () => {
    expect(CURRENT_SCHEMA_VERSION).toBeGreaterThanOrEqual(55);
    const db = await getDatabase();
    const row = (await db.query<{ name: string }>(`SELECT name FROM schema_migrations WHERE version = 55`)).rows[0];
    expect(row?.name).toBe("retired-page-price-repair");
  });

  it("puts the price the scrape replaced back on a listing the feed no longer carries, from the feed, with its observation", async () => {
    // Fails while a retired listing keeps the scraped "$100": nothing in the feed can correct it.
    const db = await getDatabase();
    stubShopify(feed([{ title: "BPC-157 5mg", handle: "bpc", price: "34.95" }, { title: "Epitalon 10mg", handle: "epi", price: "48.00" }]));
    await tick(db);
    const since = (await db.query<{ now: string }>(`SELECT NOW() AS now`)).rows[0]!.now;
    await approvePagePrice(db, bpc, "100");           // the banner, approved by a person, receipt says it replaced 34.95
    stubShopify(feed([{ title: "Epitalon 10mg", handle: "epi", price: "48.00" }]));
    await tick(db);                                   // a complete read without bpc: retired
    await db.query(`UPDATE listings SET price_source = 'catalogue' WHERE slug = $1`, [bpc]); // migration 53's default …
    await recordTickPriceObservations(db, since);
    const { repairPriceSourceForPagePrices } = await import("@/server/db/price-source-repair");
    await repairPriceSourceForPagePrices(db);          // … then migration 54: 'page' again
    expect(await listing(db, bpc)).toMatchObject({ price: "100.00", price_source: "page", availability: "Unavailable" });

    expect(await repairRetiredPagePrices(db)).toEqual({ listings: 1, observations: 1 });
    expect(await listing(db, bpc)).toMatchObject({ price: "34.95", price_source: "catalogue", availability: "Unavailable" });
    expect((await observations(db, bpc)).at(-1)).toMatchObject({ price: "34.95", source: "catalogue", available: false });
    expect(await repairRetiredPagePrices(db)).toEqual({ listings: 0, observations: 0 });
  });

  it("leaves an AVAILABLE scraped price to the feed (control)", async () => {
    // Fails if the repair touches listings the feed will correct itself, with a receipt.
    const db = await getDatabase();
    stubShopify(feed([{ title: "BPC-157 5mg", handle: "bpc", price: "34.95" }]));
    await tick(db);
    await approvePagePrice(db, bpc, "100");
    expect(await listing(db, bpc)).toMatchObject({ price: "100.00", price_source: "page", availability: "In stock" });
    expect(await repairRetiredPagePrices(db)).toEqual({ listings: 0, observations: 0 });
    expect((await listing(db, bpc)).price).toBe("100.00");
  });

  it("leaves a retired listing whose price the feed set alone (control)", async () => {
    const db = await getDatabase();
    stubShopify(feed([{ title: "BPC-157 5mg", handle: "bpc", price: "34.95" }, { title: "Epitalon 10mg", handle: "epi", price: "48.00" }]));
    await tick(db);
    stubShopify(feed([{ title: "Epitalon 10mg", handle: "epi", price: "48.00" }]));
    await tick(db);
    expect(await listing(db, bpc)).toMatchObject({ price: "34.95", price_source: "catalogue", availability: "Unavailable" });
    expect(await repairRetiredPagePrices(db)).toEqual({ listings: 0, observations: 0 });
  });
});

describe("a compound's median is a current-offer figure", () => {
  it("ranks only listings a buyer can buy now, while listing_count still counts every listing tracked", async () => {
    // Fails while Unavailable listings rank in the median: one retired "$100" pulls the whole compound.
    const db = await getDatabase();
    await upsertLiveVendor(db, { slug: "median-vendor", name: "Median Vendor", domains: ["median.example"], description: "fixture" });
    const add = (slug: string, price: number, availability: "In stock" | "Unavailable") =>
      recordCatalogListing(db, { compoundSlug: "bpc-157", vendorSlug: "median-vendor", slug, name: `BPC-157 ${slug}`, quantity: "5mg", externalUrl: `https://median.example/${slug}`, price, availability, sourceUrl: `https://median.example/${slug}`, sourceLabel: "Median" });
    await db.query(`UPDATE products SET status = 'retired' WHERE compound_id = (SELECT id FROM compounds WHERE slug = 'bpc-157')`);
    await add("median-vendor-a", 30, "In stock");
    await add("median-vendor-b", 40, "In stock");
    await add("median-vendor-c", 50, "In stock");
    await add("median-vendor-d", 100, "Unavailable");
    await recomputeCompoundStats(db);
    expect(await median(db, "bpc-157")).toBe(40);
    const count = Number((await db.query<{ listing_count: string }>(`SELECT listing_count FROM compounds WHERE slug = 'bpc-157'`)).rows[0]!.listing_count);
    expect(count).toBe(4);
    // The public projection agrees on both medians — sticker and per-mg — and still lists all three.
    const { getCatalogSnapshot } = await import("@/server/catalog/repository");
    const snapshot = await getCatalogSnapshot();
    const compound = snapshot.compounds.find((c) => c.slug === "bpc-157")!;
    expect(compound.medianPrice).toBe(40);
    expect(compound.medianPricePerMg).toBe(8); // median of 6, 8, 10 $/mg — the $100 / 5 mg retired listing is not a peer
    expect(compound.listings).toBe(4);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { CURRENT_SCHEMA_VERSION } from "@/server/db/migrations";
import { repairPriceSourceForPagePrices } from "@/server/db/price-source-repair";
import { runCollectionTick, syncCollectionTargets } from "@/server/collect/scheduler";
import { runSourceIngestion } from "@/server/agents/pipeline";
import { reviewClaim } from "@/server/review/repository";
import { recordTickPriceObservations } from "@/server/ingest/price-history";

// Migration 54. Migration 53 added listings.price_source DEFAULT 'catalogue' with no backfill, so
// a price that an approved PAGE-SCRAPE claim had set before the column existed was stamped as the
// feed's own. The Phase-3 exemption "a scrape-set price never holds off its own correction"
// (catalogue-claims.ts) keys on price_source === 'page' and therefore never matched the 27
// umbrella-labs "$100" listings it was written for: on the next feed read they were held again as
// a ÷6 move. The column must be derived from the receipts.

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
const bpc = "bluum-peptides-bpc-157";
const feed = (price: string) => ({ products: [{ title: "BPC-157 5mg", handle: "bpc", variants: [{ title: "Default Title", price, available: true }] }] });
function stubShopify(body: unknown) {
  vi.stubGlobal("fetch", (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch);
}
async function tick(db: Db) {
  await syncCollectionTargets(db);
  await db.query(`UPDATE collection_targets SET next_due_at = NOW() + interval '1 day'`);
  await db.query(`UPDATE collection_targets SET next_due_at = NOW() - interval '1 hour', enabled = TRUE, consecutive_failures = 0 WHERE id = $1`, [bluum]);
  return runCollectionTick({ budgetMs: 8_000, maxTargets: 1, connection: db });
}
const listing = async (db: Db) =>
  (await db.query<{ id: string; price: string; price_source: string; external_url: string }>(`SELECT id, price, price_source, external_url FROM listings WHERE slug = $1`, [bpc])).rows[0]!;
const latestClaim = async (db: Db) =>
  (await db.query<{ review_status: string; extractor_version: string; value_json: unknown }>(
    `SELECT ec.review_status, ec.extractor_version, ec.value_json FROM evidence_claims ec JOIN listings l ON l.id = ec.subject_id
     WHERE l.slug = $1 AND ec.predicate = 'price' ORDER BY ec.created_at DESC LIMIT 1`, [bpc])).rows[0];
const observations = async (db: Db) =>
  (await db.query<{ price: string; source: string }>(`SELECT price, source FROM price_observations WHERE listing_slug = $1 ORDER BY observed_day`, [bpc])).rows;

/** A person approves a price a page scrape proposed — the real writer that sets price_source = 'page'. */
async function approvePagePrice(db: Db, price: string) {
  const row = await listing(db);
  await runSourceIngestion({
    sourceType: "vendor-page", canonicalLocation: row.external_url, label: "Bluum product page", targetListingSlug: bpc,
    rawContent: `<html><body><h1>BPC-157 5mg</h1><p>Price: $${price}</p><p>Orders over $150 ship free.</p></body></html>`,
    contentType: "text/html", actor: "test:migration-54",
  });
  const pending = (await db.query<{ id: string }>(`SELECT id FROM evidence_claims WHERE subject_id = $1 AND predicate = 'price' AND review_status = 'pending' ORDER BY created_at DESC LIMIT 1`, [row.id])).rows[0];
  expect(pending, `a pending page price claim for $${price}`).toBeTruthy();
  await reviewClaim({ claimId: pending!.id, decision: "approve", actor: "test:person", role: "admin", notes: "test: a person approved the scraped price" });
  const after = await listing(db);
  expect(Number(after.price)).toBe(Number(price));
  expect(after.price_source).toBe("page");
}

/** What migration 53 left behind: every live listing defaulted to 'catalogue', its observation with it. */
async function emulateMigration53Default(db: Db, since: string) {
  await db.query(`UPDATE listings SET price_source = 'catalogue' WHERE slug = $1`, [bpc]);
  await recordTickPriceObservations(db, since);
}

describe("migration 54 derives price_source from the receipts", () => {
  it("is registered as a migration that every fresh database applies", async () => {
    expect(CURRENT_SCHEMA_VERSION).toBeGreaterThanOrEqual(54);
    const db = await getDatabase();
    const row = (await db.query<{ name: string }>(`SELECT name FROM schema_migrations WHERE version = 54`)).rows[0];
    expect(row?.name).toBe("price-source-page-repair");
  });

  it("marks a listing 'page' when its latest published price claim came from a scrape, and the feed then overrules it whatever the size", async () => {
    // Fails while the column keeps migration 53's default: the ÷6 correction is held again.
    const db = await getDatabase();
    stubShopify(feed("34.95"));
    await tick(db);
    const since = (await db.query<{ now: string }>(`SELECT NOW() AS now`)).rows[0]!.now;
    await approvePagePrice(db, "80");
    await approvePagePrice(db, "100"); // the LATEST receipt is the one that set today's price
    await emulateMigration53Default(db, since);
    expect((await listing(db)).price_source).toBe("catalogue");
    expect((await observations(db)).at(-1)).toMatchObject({ price: "100.00", source: "catalogue" });

    expect(await repairPriceSourceForPagePrices(db)).toEqual({ listings: 1, observations: 1 });
    expect(await listing(db)).toMatchObject({ price: "100.00", price_source: "page" });
    expect((await observations(db)).at(-1)).toMatchObject({ price: "100.00", source: "page" });

    // Idempotent: a second run has nothing left to say.
    expect(await repairPriceSourceForPagePrices(db)).toEqual({ listings: 0, observations: 0 });

    stubShopify(feed("16"));
    await tick(db);
    expect(await listing(db)).toMatchObject({ price: "16.00", price_source: "catalogue" });
    expect(await latestClaim(db)).toMatchObject({ review_status: "published", extractor_version: "catalogue-feed" });
  });

  it("leaves a feed-set price alone, so a six-fold move on it is still held (control)", async () => {
    const db = await getDatabase();
    stubShopify(feed("100"));
    await tick(db);
    expect(await repairPriceSourceForPagePrices(db)).toEqual({ listings: 0, observations: 0 });
    expect((await listing(db)).price_source).toBe("catalogue");
    stubShopify(feed("16"));
    await tick(db);
    expect((await listing(db)).price).toBe("100.00");
    expect(await latestClaim(db)).toMatchObject({ review_status: "pending", extractor_version: "catalogue-feed" });
  });

  it("leaves a price alone when the feed's own claim is the latest receipt, even though a scrape once set it (control)", async () => {
    // Fails if the repair ignores which extractor wrote the latest claim.
    const db = await getDatabase();
    stubShopify(feed("34.95"));
    await tick(db);
    await approvePagePrice(db, "100");
    stubShopify(feed("25.99")); // ÷3.8 — publishes, and is now the latest receipt
    await tick(db);
    expect(await listing(db)).toMatchObject({ price: "25.99", price_source: "catalogue" });
    expect(await latestClaim(db)).toMatchObject({ review_status: "published", extractor_version: "catalogue-feed" });
    expect(await repairPriceSourceForPagePrices(db)).toEqual({ listings: 0, observations: 0 });
    expect((await listing(db)).price_source).toBe("catalogue");
  });

  it("leaves a price alone when it no longer equals what the scrape claim published (control)", async () => {
    // Fails if the repair trusts the extractor alone and not the value. The direct UPDATE stands in
    // for any later writer the receipts do not account for; the guard must not attribute that price
    // to the scrape.
    const db = await getDatabase();
    stubShopify(feed("34.95"));
    await tick(db);
    await approvePagePrice(db, "100");
    await db.query(`UPDATE listings SET price = 42, price_source = 'catalogue' WHERE slug = $1`, [bpc]);
    expect(await repairPriceSourceForPagePrices(db)).toEqual({ listings: 0, observations: 0 });
    expect((await listing(db)).price_source).toBe("catalogue");
  });
});

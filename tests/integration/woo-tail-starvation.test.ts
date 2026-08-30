import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { retireUnseenListings, runCollectionTick, syncCollectionTargets } from "@/server/collect/scheduler";
import { recordCatalogListing, upsertLiveCompound, upsertLiveVendor } from "@/server/ingest/live-sources";

// A Woo catalogue read is bounded — 220 per-variation fetches, a 40 s deadline — and the feed's
// order is stable. So in feed order the same tail of sized products was cut on every read, and a
// "complete" page read then retired their size listings as no longer sold. On 2026-08-30
// umbrella-labs (382 variation ids) had in-stock retatrutide, DSIP and tesamorelin vials reading
// "Unavailable" at a junk $100 the feed could never correct, because no read ever looked at them.
//
// The whole path, through the same tick production runs: 29 sized products × 8 variations = 232
// fetches against the budget of 220, so 27 fit and the rest are cut on every read.

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
// swiss-chems is the Woo vendor the curated list already carries.
const TARGET = "ct:catalog-woo:swiss-chems";
const SIZES = ["2mg", "5mg", "10mg", "15mg", "20mg", "30mg", "40mg", "60mg"];
/** 29 distinct compounds, written through the live-compound writer so every fixture product matches exactly one. */
async function twentyNineCompounds(db: Db): Promise<{ slug: string; name: string }[]> {
  const out: { slug: string; name: string }[] = [];
  for (let i = 0; i < 29; i += 1) {
    const slug = `zeta-${101 + i}`; const name = `ZETA-${101 + i}`;
    await upsertLiveCompound(db, { slug, name, shorthand: name, category: "Research peptide", description: "fixture compound", aliases: [] });
    out.push({ slug, name });
  }
  return out;
}
function sizedProduct(i: number, compound: { slug: string; name: string }) {
  const id = 1000 + i;
  return {
    id, name: `${compound.name} Peptide Vial`, permalink: `https://swisschems.is/product/${compound.slug}`, type: "variable", is_in_stock: true,
    prices: { price: "2999", regular_price: "2999", sale_price: "2999", price_range: { min_amount: "2999", max_amount: "9999" }, currency_minor_unit: 2 },
    attributes: [{ name: "Size", has_variations: true, terms: SIZES.map((s) => ({ name: s, slug: s })) }],
    variations: SIZES.map((s, k) => ({ id: id * 100 + k, attributes: [{ name: "Size", value: s }] })),
  };
}
function stubStoreApi(products: ReturnType<typeof sizedProduct>[]) {
  vi.stubGlobal("fetch", (async (url: string | URL) => {
    const u = String(url);
    const single = u.match(/\/products\/(\d+)$/);
    if (single) {
      const id = Number(single[1]); const k = id % 100;
      return new Response(JSON.stringify({ variation: `Size: ${SIZES[k]}`, is_in_stock: true, prices: { price: String(2999 + k * 1000), price_range: null, currency_minor_unit: 2 } }), { status: 200 });
    }
    if (u.includes("/wc/store/v1/products")) return new Response(JSON.stringify(products), { status: 200, headers: { "x-wp-totalpages": "1" } });
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch);
}
async function tick(db: Db) {
  await syncCollectionTargets(db);
  await db.query(`UPDATE collection_targets SET next_due_at = NOW() + interval '1 day'`);
  await db.query(`UPDATE collection_targets SET next_due_at = NOW() - interval '1 hour', enabled = TRUE, consecutive_failures = 0 WHERE id = $1`, [TARGET]);
  return runCollectionTick({ budgetMs: 60_000, maxTargets: 1, connection: db });
}
const listings = async (db: Db, compound: string) =>
  (await db.query<{ slug: string; availability: string; observed_at: string }>(
    `SELECT l.slug, l.availability, l.observed_at::text AS observed_at FROM listings l JOIN products p ON p.id = l.product_id
     WHERE p.vendor_id = 'org:swiss-chems' AND l.origin = 'live' AND l.slug LIKE $1 ORDER BY l.slug`, [`swiss-chems-${compound}%`])).rows;

describe("a bounded catalogue read never retires what it did not look at, and looks at the cut tail first next time", () => {
  it("through the tick: the cut product is exempt from retirement, is evaluated first next read, and a vanished product is still retired", async () => {
    // Fails while the read records a range price for the cut product and retires its sizes, or
    // while feed order decides who gets cut — the same tail, every read.
    const db = await getDatabase();
    const compounds = await twentyNineCompounds(db);
    const [cutA, cutB, cutSecond, gone] = [compounds[27]!, compounds[28]!, compounds[26]!, compounds[25]!];
    const products = compounds.map((c, i) => sizedProduct(i, c));
    stubStoreApi(products);
    const first = await tick(db);
    const run1 = first.ran.find((r) => r.target === "swiss-chems");
    expect(run1).toMatchObject({ ok: true, retired: 0 });
    // 27 products × 8 = 216 fetches fit; the last two in feed order are cut and left unwritten.
    expect(await listings(db, cutA.slug)).toHaveLength(0);
    expect(await listings(db, cutB.slug)).toHaveLength(0);
    expect((await listings(db, cutSecond.slug)).length).toBeGreaterThan(1);
    const secondBefore = await listings(db, cutSecond.slug);

    // Second read: the two never-seen products go first; then the evaluated ones, stalest first, so
    // the 27th is the one cut this time. Meanwhile the vendor dropped the 26th from its feed.
    stubStoreApi(products.filter((p) => !p.permalink.endsWith(`/${gone.slug}`)));
    const second = await tick(db);
    const run2 = second.ran.find((r) => r.target === "swiss-chems");
    expect(run2?.ok).toBe(true);
    expect((await listings(db, cutA.slug)).length).toBeGreaterThan(1);
    expect((await listings(db, cutB.slug)).length).toBeGreaterThan(1);
    // The cut product was untouched (same observed_at), still for sale, NOT retired.
    const secondAfter = await listings(db, cutSecond.slug);
    expect(secondAfter.map((l) => l.observed_at)).toEqual(secondBefore.map((l) => l.observed_at));
    expect(secondAfter.every((l) => l.availability !== "Unavailable")).toBe(true);
    // The vanished product, on a complete read: retired, and counted.
    const vanished = await listings(db, gone.slug);
    expect(vanished.length).toBeGreaterThan(0);
    expect(vanished.every((l) => l.availability === "Unavailable")).toBe(true);
    expect(run2?.retired).toBe(vanished.length);
  });

  it("retireUnseenListings leaves an exempt product page alone and retires the rest (control)", async () => {
    const db = await getDatabase();
    await upsertLiveVendor(db, { slug: "exempt-vendor", name: "Exempt Vendor", domains: ["exempt.example"], description: "fixture" });
    const url = (c: string) => `https://exempt.example/p/${c}`;
    for (const c of ["bpc-157", "epitalon"]) {
      await recordCatalogListing(db, { compoundSlug: c, vendorSlug: "exempt-vendor", slug: `exempt-vendor-${c}`, name: `${c} 5mg`, quantity: "5mg", externalUrl: url(c), price: 34.95, availability: "In stock", sourceUrl: url(c), sourceLabel: "Exempt" });
    }
    await db.query(`UPDATE listings SET observed_at = NOW() - interval '1 hour' WHERE slug LIKE 'exempt-vendor-%'`);
    const since = (await db.query<{ now: string }>(`SELECT NOW() AS now`)).rows[0]!.now;
    expect(await retireUnseenListings(db, "exempt-vendor", since, [url("bpc-157")])).toBe(1);
    const rows = (await db.query<{ slug: string; availability: string }>(`SELECT slug, availability FROM listings WHERE slug LIKE 'exempt-vendor-%' ORDER BY slug`)).rows;
    expect(rows).toEqual([{ slug: "exempt-vendor-bpc-157", availability: "In stock" }, { slug: "exempt-vendor-epitalon", availability: "Unavailable" }]);
  });
});

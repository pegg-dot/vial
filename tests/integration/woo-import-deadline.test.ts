import { beforeEach, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { importWooCommerceCatalog } from "@/server/ingest/woocommerce-import";

// A variable product costs one request per variation. 134 of them on one host is a minute of
// fetching the tick cannot afford; past its deadline the importer records what it already knows —
// the product-level price — and returns, instead of being killed with nothing written.

beforeEach(async () => {
  process.env.VIALGRADE_PGLITE_MEMORY = "true";
  process.env.VIALGRADE_SEED_FIXTURES = "true";
  process.env.VIALGRADE_SEED_DEMO_ACCOUNTS = "true";
  delete (globalThis as { __vialEvidenceSeedPromise?: unknown }).__vialEvidenceSeedPromise;
  delete (globalThis as { __vialSellerOpsSeedPromise?: unknown }).__vialSellerOpsSeedPromise;
  await resetDatabaseForTests();
});

const variable = (id: number, name: string) => ({
  id, name, permalink: `https://slow.example/p/${id}`, type: "variable", is_in_stock: true,
  prices: { price: "3495", regular_price: "3495", sale_price: "3495", price_range: { min_amount: "3495", max_amount: "5995" }, currency_minor_unit: 2 },
  variations: [{ id: id * 10 + 1, attributes: [{ name: "Options", value: "5-milligrams" }] }, { id: id * 10 + 2, attributes: [{ name: "Options", value: "10-milligrams" }] }],
  attributes: [{ name: "Options", has_variations: true, terms: [{ name: "5 mg", slug: "5-milligrams" }, { name: "10 mg", slug: "10-milligrams" }] }],
});
const slowVariation = async (_origin: string, id: number) => {
  await new Promise((r) => setTimeout(r, 80));
  return { variation: id % 10 === 1 ? "Options: 5 mg" : "Options: 10 mg", is_in_stock: true, prices: { price: id % 10 === 1 ? "3495" : "5995", price_range: null, currency_minor_unit: 2 } };
};
const input = (deadlineAt?: number) => ({
  vendorSlug: "slow-vendor", vendorName: "Slow Vendor", domain: "slow.example", description: "fixture",
  compounds: [{ slug: "bpc-157", name: "BPC-157", aliases: [] }, { slug: "epitalon", name: "Epitalon", aliases: [] }],
  products: [variable(1, "BPC-157 vial"), variable(2, "Epitalon vial")] as never,
  fetchVariation: slowVariation,
  ...(deadlineAt ? { deadlineAt } : {}),
});

describe("importWooCommerceCatalog under a deadline", () => {
  it("records every size when there is time (control)", async () => {
    const db = await getDatabase();
    const result = await importWooCommerceCatalog(db, input());
    expect(result.imported.map((r) => r.slug).sort()).toEqual(["slow-vendor-bpc-157", "slow-vendor-bpc-157-10mg", "slow-vendor-epitalon", "slow-vendor-epitalon-10mg"]);
  });

  it("past its deadline, records the product-level price and returns instead of fetching variations", async () => {
    // Fails while the importer has no deadline and fetches every variation regardless.
    const db = await getDatabase();
    const t0 = Date.now();
    const result = await importWooCommerceCatalog(db, input(Date.now() - 1));
    expect(Date.now() - t0).toBeLessThan(400);
    expect(result.imported.map((r) => r.slug).sort()).toEqual(["slow-vendor-bpc-157", "slow-vendor-epitalon"]);
    expect(result.imported.every((r) => r.price === 34.95)).toBe(true);
  });
});

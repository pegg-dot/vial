import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabaseForTests } from "@/server/db/client";
import { listPublicPassportsForCompound } from "@/server/evidence-network/repository";

// A batch passport can be tied to its compound only through its product (the seed's own passport
// is), so a compound page must find it that way too. Before this, BPC-157 reported "0 batch
// passports" while the batch-record directory listed one for it.
describe("batch passports found through the product's compound", () => {
  beforeEach(async () => {
    process.env.VIALGRADE_PGLITE_MEMORY = "true";
    process.env.VIALGRADE_SEED_FIXTURES = "true";
    process.env.VIALGRADE_SEED_DEMO_ACCOUNTS = "true";
    delete (globalThis as { __vialEvidenceSeedPromise?: unknown }).__vialEvidenceSeedPromise;
    delete (globalThis as { __vialSellerOpsSeedPromise?: unknown }).__vialSellerOpsSeedPromise;
    await resetDatabaseForTests();
  });

  it("returns the seeded HX-BPC-2607 passport for bpc-157 with its vendor slug", async () => {
    const rows = await listPublicPassportsForCompound("bpc-157", 12) as Array<{ declared_batch_code: string; vendor_slug: string | null; compound_slug: string | null }>;
    const hx = rows.find((row) => row.declared_batch_code === "HX-BPC-2607");
    expect(hx).toBeTruthy();
    expect(hx!.vendor_slug).toBeTruthy();
  });

  it("does not hand another compound's passports back", async () => {
    const rows = await listPublicPassportsForCompound("epitalon", 12) as Array<{ declared_batch_code: string }>;
    expect(rows.some((row) => row.declared_batch_code === "HX-BPC-2607")).toBe(false);
  });
});

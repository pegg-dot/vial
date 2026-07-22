import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { computeListingTrustMap } from "@/server/verify/listing-trust";
import { crossCheckCoa } from "@/server/verify/coa-cross-check";
import { newId } from "@/server/db/ids";

process.env.VIAL_PGLITE_MEMORY = "true";
process.env.VIAL_SESSION_SECRET = "listing-trust-test-secret-at-least-32-characters";
process.env.VIAL_PRIVACY_HASH_SECRET = "listing-trust-privacy-secret-at-least-32-characters";

async function seedLabTest(row: { vendor_slug: string | null; manufacturer: string; compound_slug: string; batch_code?: string; purity?: number }) {
  const db = await getDatabase();
  await db.query(
    `INSERT INTO lab_test_records (id,lab,verify_url,verify_key,compound_slug,sample_name,manufacturer,vendor_slug,batch_code,purity_pct,origin)
     VALUES ($1,'Janoshik Analytical',$2,$3,$4,$5,$6,$7,$8,$9,'live')`,
    [newId("labtest"), `https://verify.janoshik.com/tests/${newId("t")}`, "K" + Math.floor((row.purity ?? 99) * 10), row.compound_slug, row.compound_slug, row.manufacturer, row.vendor_slug, row.batch_code ?? null, row.purity ?? null],
  );
}

describe("listing trust (the everywhere chip)", () => {
  beforeAll(async () => { await resetDatabaseForTests(); await getDatabase(); });
  afterAll(async () => { await resetDatabaseForTests(); });

  it("agrees with the full crossCheckCoa verdict for the same listing", async () => {
    await seedLabTest({ vendor_slug: "aspen-peptides", manufacturer: "Aspen Peptides", compound_slug: "bpc-157", purity: 99.2 });
    const db = await getDatabase();
    const input = { slug: "aspen-bpc", vendorSlug: "aspen-peptides", compoundSlug: "bpc-157", reportIssuer: "Janoshik", reportConfirmed: true, batchCode: "" };
    const map = await computeListingTrustMap(db, [input]);
    const full = await crossCheckCoa(db, { vendorSlug: "aspen-peptides", compoundSlug: "bpc-157", reportIssuer: "Janoshik", reportConfirmed: true, batchCode: "" });
    expect(map.get("aspen-bpc")?.status).toBe("verified");
    expect(map.get("aspen-bpc")?.status).toBe(full.status);
    expect(map.get("aspen-bpc")?.tone).toBe("good");
  });

  it("flags a borrowed certificate as a mismatch (bad tone)", async () => {
    await seedLabTest({ vendor_slug: "real-maker", manufacturer: "Real Maker", compound_slug: "ipamorelin", batch_code: "RM-BATCH-77", purity: 98 });
    const db = await getDatabase();
    const map = await computeListingTrustMap(db, [{ slug: "copycat", vendorSlug: "copycat-peptides", compoundSlug: "ipamorelin", reportIssuer: "Janoshik", reportConfirmed: true, batchCode: "RM-BATCH-77" }]);
    expect(map.get("copycat")?.status).toBe("mismatch");
    expect(map.get("copycat")?.tone).toBe("bad");
  });

  it("marks a suspiciously-cheap listing (far below the market median $/mg)", async () => {
    const db = await getDatabase();
    const inputs = [
      { slug: "a", vendorSlug: "v1", compoundSlug: "tb-500", pricePerMg: 10 },
      { slug: "b", vendorSlug: "v2", compoundSlug: "tb-500", pricePerMg: 10 },
      { slug: "c", vendorSlug: "v3", compoundSlug: "tb-500", pricePerMg: 10 },
      { slug: "d", vendorSlug: "v4", compoundSlug: "tb-500", pricePerMg: 3 },
    ];
    const map = await computeListingTrustMap(db, inputs);
    expect(map.get("d")?.priceFlag).toBe("too-cheap");
    expect(map.get("a")?.priceFlag).toBeNull();
  });

  it("marks a genuine price drop", async () => {
    const db = await getDatabase();
    const map = await computeListingTrustMap(db, [{ slug: "drop", vendorSlug: "v9", compoundSlug: "mk-677", price: 80, previousPrice: 100 }]);
    expect(map.get("drop")?.priceFlag).toBe("price-drop");
    expect(map.get("drop")?.priceNote).toMatch(/20%/);
  });

  it("surfaces compound-level COA evidence even when the vendor is unverified", async () => {
    await seedLabTest({ vendor_slug: null, manufacturer: "Alpha BioPharma", compound_slug: "ghk-cu", purity: 99.4 });
    await seedLabTest({ vendor_slug: null, manufacturer: "PeptideGurus", compound_slug: "ghk-cu", purity: 99.6 });
    await seedLabTest({ vendor_slug: null, manufacturer: "Unknown", compound_slug: "ghk-cu" });
    const db = await getDatabase();
    const map = await computeListingTrustMap(db, [{ slug: "retail-ghk", vendorSlug: "bluum-peptides", compoundSlug: "ghk-cu" }]);
    const t = map.get("retail-ghk");
    expect(t?.status).toBe("no-claim");        // vendor not verified
    expect(t?.compoundCoas).toBe(3);            // but the compound is characterized
    expect(t?.compoundMedianPurity).toBeCloseTo(99.5, 1);
  });

  it("keeps an unbacked demo-style claim quiet (neutral tone, shown only where opted in)", async () => {
    const db = await getDatabase();
    const map = await computeListingTrustMap(db, [{ slug: "ghost", vendorSlug: "ghost-labs", compoundSlug: "semaglutide", reportIssuer: "Janoshik", reportConfirmed: true, batchCode: "GL-1" }]);
    expect(map.get("ghost")?.status).toBe("unbacked");
    expect(map.get("ghost")?.tone).toBe("neutral");
  });
});

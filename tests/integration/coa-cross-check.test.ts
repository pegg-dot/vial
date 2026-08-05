import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { crossCheckCoa } from "@/server/verify/coa-cross-check";
import { newId } from "@/server/db/ids";

process.env.VIAL_PGLITE_MEMORY = "true";
process.env.VIAL_SESSION_SECRET = "coa-cross-check-test-secret-at-least-32chars";
process.env.VIAL_PRIVACY_HASH_SECRET = "coa-cross-check-privacy-secret-at-least-32chars";

async function seedLabTest(row: { vendor_slug: string | null; manufacturer: string; compound_slug: string; batch_code?: string; purity?: number; verify?: string; independent?: boolean }) {
  const db = await getDatabase();
  await db.query(
    `INSERT INTO lab_test_records (id,lab,verify_url,verify_key,compound_slug,sample_name,manufacturer,vendor_slug,batch_code,purity_pct,is_independent,origin)
     VALUES ($1,'Janoshik Analytical',$2,$3,$4,$5,$6,$7,$8,$9,$10,'live')`,
    [newId("labtest"), row.verify ?? `https://verify.janoshik.com/tests/${newId("t")}`, "KEY" + Math.floor(row.purity ?? 99), row.compound_slug, row.compound_slug, row.manufacturer, row.vendor_slug, row.batch_code ?? null, row.purity ?? null, row.independent ?? true],
  );
}

describe("COA cross-verification", () => {
  beforeAll(async () => { await resetDatabaseForTests(); await getDatabase(); });
  afterAll(async () => { await resetDatabaseForTests(); });

  it("flags an advertised testing claim with NO independent backing as unbacked", async () => {
    const db = await getDatabase();
    const r = await crossCheckCoa(db, { vendorSlug: "ghost-labs", vendorName: "Ghost Labs", compoundSlug: "tb-500", compoundName: "TB-500", reportIssuer: "Janoshik", reportConfirmed: true, batchCode: "GL-0001" });
    expect(r.status).toBe("unbacked");
    expect(r.signals.some((s) => s.ok === false)).toBe(true);
  });

  it("confirms a testing claim that an independent record backs", async () => {
    await seedLabTest({ vendor_slug: "aspen-peptides", manufacturer: "Aspen Peptides", compound_slug: "bpc-157", purity: 99.2 });
    const db = await getDatabase();
    const r = await crossCheckCoa(db, { vendorSlug: "aspen-peptides", vendorName: "Aspen Peptides", compoundSlug: "bpc-157", compoundName: "BPC-157", reportIssuer: "Janoshik", reportConfirmed: true, batchCode: "" });
    expect(r.status).toBe("verified");
    expect(r.independentPurity).toBeCloseTo(99.2, 1);
  });

  it("surfaces low measured purity even when the vendor advertises testing", async () => {
    await seedLabTest({ vendor_slug: "thin-labs", manufacturer: "Thin Labs", compound_slug: "semaglutide", purity: 88.5 });
    const db = await getDatabase();
    const r = await crossCheckCoa(db, { vendorSlug: "thin-labs", vendorName: "Thin Labs", compoundSlug: "semaglutide", compoundName: "Semaglutide", reportIssuer: "Janoshik", reportConfirmed: true, batchCode: "" });
    expect(r.status).toBe("low-purity");
  });

  it("catches a borrowed certificate — cited batch resolves to a different manufacturer", async () => {
    await seedLabTest({ vendor_slug: "real-maker", manufacturer: "Real Maker", compound_slug: "ipamorelin", batch_code: "RM-BATCH-77", purity: 98.1 });
    const db = await getDatabase();
    // A different vendor cites Real Maker's batch as if it were their own.
    const r = await crossCheckCoa(db, { vendorSlug: "copycat-peptides", vendorName: "Copycat Peptides", compoundSlug: "ipamorelin", compoundName: "Ipamorelin", reportIssuer: "Janoshik", reportConfirmed: true, batchCode: "RM-BATCH-77" });
    expect(r.status).toBe("mismatch");
    expect(r.headline).toMatch(/different manufacturer/i);
  });

  it("verifies the exact batch when the cited batch matches the right maker", async () => {
    await seedLabTest({ vendor_slug: "honest-labs", manufacturer: "Honest Labs", compound_slug: "cjc-1295", batch_code: "HL-2024-A", purity: 99.0 });
    const db = await getDatabase();
    const r = await crossCheckCoa(db, { vendorSlug: "honest-labs", vendorName: "Honest Labs", compoundSlug: "cjc-1295", compoundName: "CJC-1295", reportIssuer: "Janoshik", reportConfirmed: true, batchCode: "HL-2024-A" });
    expect(r.status).toBe("batch-verified");
    expect(r.independentPurity).toBeCloseTo(99.0, 1);
  });

  it("flags low purity even when the vendor's own COA makes no testing claim", async () => {
    await seedLabTest({ vendor_slug: "stl-test", manufacturer: "STL Test", compound_slug: "dsip", purity: 90.17 });
    const db = await getDatabase();
    const r = await crossCheckCoa(db, { vendorSlug: "stl-test", compoundSlug: "dsip", reportIssuer: "", reportConfirmed: false, batchCode: "" });
    expect(r.status).toBe("low-purity");
  });

  it("reports no-claim when there is neither an advertised test nor an independent record", async () => {
    const db = await getDatabase();
    const r = await crossCheckCoa(db, { vendorSlug: "quiet-vendor", vendorName: "Quiet Vendor", compoundSlug: "mk-677", compoundName: "MK-677", reportIssuer: "", reportConfirmed: false, batchCode: "" });
    expect(r.status).toBe("no-claim");
  });

  it("does NOT treat a vendor's own self-published COA as independent verification", async () => {
    await seedLabTest({ vendor_slug: "selfy-labs", manufacturer: "Selfy Labs", compound_slug: "kisspeptin-10", purity: 99, independent: false });
    const db = await getDatabase();
    const r = await crossCheckCoa(db, { vendorSlug: "selfy-labs", compoundSlug: "kisspeptin-10", reportIssuer: "Janoshik", reportConfirmed: true, batchCode: "" });
    expect(r.status).toBe("unbacked");   // claims testing, but the only record is the vendor's own word
  });

  it("does NOT show a DIFFERENT compound's purity as this batch's verification", async () => {
    // Same vendor's independent record for SELANK, batch shared; the vendor also lists SEMAX citing it.
    await seedLabTest({ vendor_slug: "shared-batch-labs", manufacturer: "Shared Batch Labs", compound_slug: "selank", batch_code: "SBL-777-2026", purity: 99.5 });
    const db = await getDatabase();
    const r = await crossCheckCoa(db, { vendorSlug: "shared-batch-labs", compoundSlug: "semax", reportIssuer: "Janoshik", reportConfirmed: true, batchCode: "SBL-777-2026" });
    expect(r.status).not.toBe("batch-verified");    // the batch is real, but for SELANK not SEMAX
    expect(r.independentPurity ?? null).not.toBe(99.5);  // must not borrow selank's number
  });

  it("does NOT batch-verify from a self-published certificate", async () => {
    await seedLabTest({ vendor_slug: "selfbatch", manufacturer: "SelfBatch", compound_slug: "tesamorelin", batch_code: "SELF-9001-X", purity: 98, independent: false });
    const db = await getDatabase();
    const r = await crossCheckCoa(db, { vendorSlug: "selfbatch", compoundSlug: "tesamorelin", reportIssuer: "Janoshik", reportConfirmed: true, batchCode: "SELF-9001-X" });
    expect(r.status).not.toBe("batch-verified");
  });

  it("ignores a too-short (collision-prone) batch code rather than asserting a batch verdict", async () => {
    await seedLabTest({ vendor_slug: "short-a", manufacturer: "Short A", compound_slug: "aod-9604", batch_code: "AB12", purity: 99 });
    const db = await getDatabase();
    const r = await crossCheckCoa(db, { vendorSlug: "short-b", compoundSlug: "aod-9604", reportIssuer: "Janoshik", reportConfirmed: true, batchCode: "AB12" });
    expect(r.status).not.toBe("mismatch");        // 4-char code is too collision-prone to accuse
    expect(r.status).not.toBe("batch-verified");
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { getCertificatesOnRecord, getSamplingStats } from "@/server/public-repository";
import { newId } from "@/server/db/ids";

process.env.VIAL_PGLITE_MEMORY = "true";
process.env.VIAL_SESSION_SECRET = "cert-count-test-secret-at-least-32-characters";
process.env.VIAL_PRIVACY_HASH_SECRET = "cert-count-privacy-secret-at-least-32-characters";

// A certificate is one row per verify_url. Vary the compound/vendor match so the corpus is a
// strict superset of the compound-matched and vendor-matched subtotals the pages used to sum.
async function seedCert(row: { verify_url: string; compound_slug: string | null; vendor_slug: string | null }) {
  const db = await getDatabase();
  await db.query(
    `INSERT INTO lab_test_records (id,lab,verify_url,verify_key,compound_slug,sample_name,manufacturer,vendor_slug,origin)
     VALUES ($1,'Janoshik Analytical',$2,$3,$4,'Sample','Maker',$5,'live')`,
    [newId("labtest"), row.verify_url, newId("k"), row.compound_slug, row.vendor_slug],
  );
}

describe("certificates on record (the one site-wide total)", () => {
  beforeAll(async () => { await resetDatabaseForTests(); await getDatabase(); });
  afterAll(async () => { await resetDatabaseForTests(); });

  it("counts every distinct certificate — including ones not matched to a tracked compound or vendor", async () => {
    await seedCert({ verify_url: "https://verify.janoshik.com/c/a", compound_slug: "bpc-157", vendor_slug: "aspen-peptides" }); // both matched
    await seedCert({ verify_url: "https://verify.janoshik.com/c/b", compound_slug: "bpc-157", vendor_slug: null });            // vendor unmatched
    await seedCert({ verify_url: "https://verify.janoshik.com/c/c", compound_slug: null, vendor_slug: "aspen-peptides" });     // compound unmatched
    await seedCert({ verify_url: "https://verify.janoshik.com/c/d", compound_slug: null, vendor_slug: null });                 // neither — real evidence, still on record
    // Σ compound.coaCount would see 2 (a,b); Σ vendor.coaCount 2 (a,c); the honest corpus is 4.
    expect(await getCertificatesOnRecord()).toBe(4);
  });

  it("is the single source of truth for the /testing certificate total", async () => {
    const canonical = await getCertificatesOnRecord();
    expect((await getSamplingStats()).total).toBe(canonical);
  });

  it("does not double-count a certificate — verify_url is unique", async () => {
    const before = await getCertificatesOnRecord();
    await expect(
      seedCert({ verify_url: "https://verify.janoshik.com/c/a", compound_slug: "bpc-157", vendor_slug: "other" }),
    ).rejects.toThrow();                                   // the UNIQUE(verify_url) constraint rejects a re-add
    expect(await getCertificatesOnRecord()).toBe(before); // count unchanged
  });
});

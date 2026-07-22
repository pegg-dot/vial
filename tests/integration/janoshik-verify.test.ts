import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { recordLabTest, getLabTestsForVendor } from "@/server/ingest/lab-tests";
import { annotateJanoshikListings } from "@/server/verify/janoshik-verify";

process.env.VIAL_PGLITE_MEMORY = "true";
process.env.VIAL_SESSION_SECRET = "janoshik-verify-test-secret-at-least-32-characters";
process.env.VIAL_PRIVACY_HASH_SECRET = "janoshik-verify-privacy-secret-at-least-32-characters";

const resolve = { compounds: [], vendors: [{ slug: "acme-peptide", name: "Acme Peptide", domain: "acme.com" }] };
const entry = (verifyKey: string, manufacturer = "acme.com") => ({ testId: verifyKey, sampleName: "BPC-157 5mg", manufacturer, client: "", verifyUrl: `https://verify.janoshik.com/tests/1-BPC157_${verifyKey}`, verifyKey });

describe("janoshik live re-verification", () => {
  beforeAll(async () => {
    await resetDatabaseForTests();
    const db = await getDatabase();
    for (const k of ["AAAA11112222", "BBBB33334444"]) {
      await recordLabTest(db, { testId: k, verifyUrl: `https://verify.janoshik.com/tests/1-BPC157_${k}`, verifyKey: k, sampleName: "BPC-157 5mg", manufacturer: "acme.com", vendorSlug: "acme-peptide" }, resolve);
    }
  });
  afterAll(async () => { await resetDatabaseForTests(); });

  it("marks a cert present in the live feed as still listed, with the portal maker", async () => {
    const db = await getDatabase();
    const res = await annotateJanoshikListings(db, [entry("AAAA11112222", "acmepep.com"), entry("BBBB33334444")]);
    expect(res.keysChecked).toBe(2);
    expect(res.stillListed).toBe(2);
    expect(res.delisted).toEqual([]);
    const rows = await getLabTestsForVendor(db, "acme-peptide");
    expect(rows.every((r) => r.janoshik_listed === true)).toBe(true);
    expect(rows.every((r) => r.janoshik_checked_at != null)).toBe(true);
    expect(rows.find((r) => r.verify_url.endsWith("AAAA11112222"))?.janoshik_made_by).toBe("acmepep.com");
  });

  it("flags a previously-listed cert that has since disappeared from the feed", async () => {
    const db = await getDatabase();
    // second run: AAAA present, BBBB gone → BBBB was listed before, so it's a delisting
    const res = await annotateJanoshikListings(db, [entry("AAAA11112222")]);
    expect(res.stillListed).toBe(1);
    expect(res.delisted).toEqual(["BBBB33334444"]);
    const rows = await getLabTestsForVendor(db, "acme-peptide");
    expect(rows.find((r) => r.verify_url.endsWith("BBBB33334444"))?.janoshik_listed).toBe(false);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { recordLabTest, reconcileLabsFromRegistry } from "@/server/ingest/lab-tests";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SESSION_SECRET = "lab-reconcile-test-secret-at-least-32-characters-long";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "lab-reconcile-privacy-secret-at-least-32-characters";

const resolve = { compounds: [{ slug: "bpc-157", name: "BPC-157", aliases: ["bpc157"] }], vendors: [] as { slug: string; name: string; domain: string }[] };

describe("recordLabTest applies the registry on write", () => {
  beforeAll(async () => { await resetDatabaseForTests(); });
  afterAll(async () => { await resetDatabaseForTests(); });

  it("canonicalizes the lab name and sets independence from the registry", async () => {
    const db = await getDatabase();
    await recordLabTest(db, { testId: "1", verifyUrl: "https://v/1", sampleName: "BPC-157", manufacturer: "x", vendorSlug: "v1", lab: "Janoshik" }, resolve);
    await recordLabTest(db, { testId: "2", verifyUrl: "https://v/2", sampleName: "BPC-157", manufacturer: "x", vendorSlug: "v1", lab: "Kovera Labs" }, resolve);
    await recordLabTest(db, { testId: "3", verifyUrl: "https://v/3", sampleName: "BPC-157", manufacturer: "x", vendorSlug: "v1", lab: "SteriGenix" }, resolve);
    const rows = (await db.query<{ verify_url: string; lab: string; is_independent: boolean }>(
      `SELECT verify_url, lab, is_independent FROM lab_test_records ORDER BY verify_url`,
    )).rows;
    expect(rows[0]).toMatchObject({ lab: "Janoshik Analytical", is_independent: true }); // canonicalized + independent
    expect(rows[1]).toMatchObject({ lab: "Kovera Labs", is_independent: false }); // real but independence unverified
    expect(rows[2]).toMatchObject({ lab: "SteriGenix Analytical", is_independent: false }); // existence unconfirmed
  });
});

describe("reconcileLabsFromRegistry fixes rows stored before the registry existed", () => {
  beforeAll(async () => {
    await resetDatabaseForTests();
    const db = await getDatabase();
    // Simulate legacy rows: a split Janoshik name, and a Kovera row wrongly marked independent.
    await recordLabTest(db, { testId: "10", verifyUrl: "https://v/10", sampleName: "BPC-157", manufacturer: "x", vendorSlug: "v2", lab: "Janoshik" }, resolve);
    await db.query(`UPDATE lab_test_records SET lab='Janoshik', is_independent=TRUE WHERE verify_url='https://v/10'`);
    await recordLabTest(db, { testId: "11", verifyUrl: "https://v/11", sampleName: "BPC-157", manufacturer: "x", vendorSlug: "v2", lab: "Kovera Labs" }, resolve);
    await db.query(`UPDATE lab_test_records SET is_independent=TRUE WHERE verify_url='https://v/11'`);
  });
  afterAll(async () => { await resetDatabaseForTests(); });

  it("collapses names and corrects independence, idempotently", async () => {
    const db = await getDatabase();
    const res = await reconcileLabsFromRegistry(db);
    expect(res.renamed).toBe(1); // "Janoshik" → "Janoshik Analytical"
    expect(res.independenceChanged).toBe(1); // Kovera true → false
    const kovera = (await db.query<{ is_independent: boolean }>(`SELECT is_independent FROM lab_test_records WHERE verify_url='https://v/11'`)).rows[0];
    expect(kovera.is_independent).toBe(false);
    // Second run is a no-op.
    expect(await reconcileLabsFromRegistry(db)).toEqual({ renamed: 0, independenceChanged: 0 });
  });
});

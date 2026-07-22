import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { recordLabTest } from "@/server/ingest/lab-tests";
import { ingestNewJanoshikTests, applyPurities } from "@/server/ingest/janoshik-discovery";

process.env.VIAL_PGLITE_MEMORY = "true";
process.env.VIAL_SESSION_SECRET = "janoshik-discovery-test-secret-at-least-32-chars";
process.env.VIAL_PRIVACY_HASH_SECRET = "janoshik-discovery-privacy-secret-at-least-32-chars";

const resolve = {
  compounds: [{ slug: "bpc-157", name: "BPC-157", aliases: ["bpc157", "bpc 157"] }],
  vendors: [] as { slug: string; name: string; domain: string }[],
};

const entry = (testId: string, over: Partial<Record<"sampleName" | "manufacturer" | "client", string>> = {}) => ({
  testId,
  sampleName: over.sampleName ?? "BPC-157 10mg",
  manufacturer: over.manufacturer ?? "Unknown",
  client: over.client ?? "",
  verifyUrl: `https://verify.janoshik.com/tests/${testId}-SAMPLE_QQ${testId}ZZ99`,
  verifyKey: `QQ${testId}ZZ99`,
});

describe("janoshik new-test discovery", () => {
  beforeAll(async () => {
    await resetDatabaseForTests();
    const db = await getDatabase();
    // One COA already held from a prior run.
    await recordLabTest(db, { testId: "500", verifyUrl: entry("500").verifyUrl, verifyKey: "QQ500ZZ99", sampleName: "BPC-157 5mg", manufacturer: "acme.com" }, resolve);
  });
  afterAll(async () => { await resetDatabaseForTests(); });

  it("ingests only the tests we do not already hold, creating derived vendors", async () => {
    const db = await getDatabase();
    const feed = [
      entry("500"), // already stored → skipped
      entry("501", { client: "Certa Peptides | EU VENDOR" }),
      entry("502", { manufacturer: "https://alphabiopharma.info" }),
    ];
    const res = await ingestNewJanoshikTests(db, feed, resolve);
    expect(res.feedSize).toBe(3);
    expect(res.newTests.map((e) => e.testId)).toEqual(["501", "502"]);
    expect(res.compoundMatched).toBe(2);
    expect(res.vendorLinked).toBe(2);
    expect(res.newVendors.sort()).toEqual(["alphabiopharma", "certa-peptides"]);

    const stored = await db.query<{ test_id: string; vendor_slug: string | null; compound_slug: string | null }>(
      `SELECT test_id, vendor_slug, compound_slug FROM lab_test_records WHERE test_id IN ('501','502') ORDER BY test_id`,
    );
    expect(stored.rows).toEqual([
      { test_id: "501", vendor_slug: "certa-peptides", compound_slug: "bpc-157" },
      { test_id: "502", vendor_slug: "alphabiopharma", compound_slug: "bpc-157" },
    ]);
    const orgs = await db.query(`SELECT slug FROM organizations WHERE slug IN ('certa-peptides','alphabiopharma') AND origin='live'`);
    expect(orgs.rows).toHaveLength(2);
  });

  it("is idempotent: a second run over the same feed ingests nothing", async () => {
    const db = await getDatabase();
    const res = await ingestNewJanoshikTests(db, [entry("500"), entry("501", { client: "Certa Peptides" })], resolve);
    expect(res.newTests).toEqual([]);
    expect(res.newVendors).toEqual([]);
  });

  it("applyPurities backfills vision-read values onto already-stored janoshik rows", async () => {
    const db = await getDatabase();
    const updated = await applyPurities(db, {
      "501": { purityPct: 99.42, batch: "LOT-77", measuredContent: "10.12 mg", testedAt: "20 JUL 2026" },
      "999": { purityPct: 98.0 }, // not stored → no-op
    });
    expect(updated).toBe(1);
    const row = (await db.query<{ purity_pct: string | number | null; batch_code: string | null }>(
      `SELECT purity_pct, batch_code FROM lab_test_records WHERE test_id='501'`,
    )).rows[0];
    expect(Number(row.purity_pct)).toBeCloseTo(99.42);
    expect(row.batch_code).toBe("LOT-77");
    // Second application is a no-op (values already present).
    expect(await applyPurities(db, { "501": { purityPct: 11 } })).toBe(0);
  });
});

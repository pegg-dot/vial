import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { recordLabTest } from "@/server/ingest/lab-tests";
import { upsertLiveVendor } from "@/server/ingest/live-sources";
import { projectLiveBatchPassports, getLivePassportEvidence } from "@/server/evidence-network/live-passports";

process.env.VIAL_PGLITE_MEMORY = "true";
process.env.VIAL_SESSION_SECRET = "live-passport-test-secret-at-least-32-characters-long";
process.env.VIAL_PRIVACY_HASH_SECRET = "live-passport-privacy-secret-at-least-32-characters";

const compounds = [{ slug: "bpc-157", name: "BPC-157", aliases: ["bpc157"] }];
const resolve = { compounds, vendors: [] as { slug: string; name: string; domain: string }[] };

describe("live batch passport projection", () => {
  beforeAll(async () => {
    await resetDatabaseForTests();
    const db = await getDatabase();
    await upsertLiveVendor(db, { slug: "acme-peptide", name: "Acme Peptide", domains: ["acme.test"], description: "test" });
    // One batch with two corroborating COAs from two labs (one blind); a second single-COA batch.
    await recordLabTest(db, { testId: "1", verifyUrl: "https://v/1", sampleName: "BPC-157 5mg", manufacturer: "Acme", vendorSlug: "acme-peptide", batchCode: "LOT-A", purityPct: 99.2, lab: "Janoshik Analytical", isBlind: true, testType: "purity", testedAt: "2026-06-01" }, resolve);
    await recordLabTest(db, { testId: "2", verifyUrl: "https://v/2", sampleName: "BPC-157 5mg", manufacturer: "Acme", vendorSlug: "acme-peptide", batchCode: "LOT-A", purityPct: 99.4, lab: "MZ Biolabs", testType: "purity", testedAt: "2026-06-02" }, resolve);
    await recordLabTest(db, { testId: "3", verifyUrl: "https://v/3", sampleName: "BPC-157 5mg", manufacturer: "Acme", vendorSlug: "acme-peptide", batchCode: "LOT-B", purityPct: 98.9, lab: "Janoshik Analytical", testType: "purity", testedAt: "2026-05-01" }, resolve);
    // A COA with no batch code must NOT form a passport.
    await recordLabTest(db, { testId: "4", verifyUrl: "https://v/4", sampleName: "BPC-157 5mg", manufacturer: "Acme", vendorSlug: "acme-peptide", purityPct: 99.0, lab: "Janoshik Analytical", testType: "purity" }, resolve);
  });
  afterAll(async () => { await resetDatabaseForTests(); });

  it("creates one published live passport per (vendor, compound, batch) with a batch code", async () => {
    const db = await getDatabase();
    const res = await projectLiveBatchPassports(db);
    expect(res.passports).toBe(2); // LOT-A and LOT-B; the batch-less COA is skipped
    expect(res.vendors).toBe(1);

    const passports = (await db.query<{ declared_batch_code: string; status: string; origin: string; evidence_confidence: string | number; vendor_id: string }>(
      `SELECT declared_batch_code, status, origin, evidence_confidence, vendor_id FROM batch_passports WHERE origin='live' ORDER BY declared_batch_code`,
    )).rows;
    expect(passports.map((p) => p.declared_batch_code)).toEqual(["LOT-A", "LOT-B"]);
    expect(passports.every((p) => p.status === "published" && p.vendor_id === "org:acme-peptide")).toBe(true);
    // LOT-A (2 labs, blind, agreeing) should out-confidence LOT-B (single, older).
    const a = passports.find((p) => p.declared_batch_code === "LOT-A")!;
    const b = passports.find((p) => p.declared_batch_code === "LOT-B")!;
    expect(Number(a.evidence_confidence)).toBeGreaterThan(Number(b.evidence_confidence));
  });

  it("links each passport to its real certificates and is idempotent on re-run", async () => {
    const db = await getDatabase();
    const before = (await db.query(`SELECT COUNT(*) n FROM passport_lab_tests`)).rows[0].n;
    await projectLiveBatchPassports(db); // second run
    const after = (await db.query(`SELECT COUNT(*) n FROM passport_lab_tests`)).rows[0].n;
    expect(Number(after)).toBe(Number(before)); // no duplicate links
    expect(Number(after)).toBe(3); // LOT-A has 2, LOT-B has 1

    const evid = await getLivePassportEvidence(db, "livepassport:live-acme-peptide-bpc-157-lot-a");
    expect(evid).toHaveLength(2);
    expect(evid[0].isBlind).toBe(true); // blind sorts first
    expect(new Set(evid.map((e) => e.lab))).toEqual(new Set(["Janoshik Analytical", "MZ Biolabs"]));
  });
});

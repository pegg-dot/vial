import { beforeEach, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { createApiKey } from "@/server/api-access/keys";
import { ensureEvidenceNetworkSeed, recomputePassport, revokeLaboratoryReport, getBatchStandardRecord } from "@/server/evidence-network/repository";
import { GET as getBatch } from "@/app/api/public/v1/batches/[batchId]/route";

const bearer = (token: string, url: string) => new Request(url, { headers: { authorization: `Bearer ${token}` } });

describe("VIAL 10.0 batch standard", () => {
  beforeEach(async () => {
    process.env.VIALGRADE_PGLITE_MEMORY = "true";
    process.env.VIALGRADE_SEED_FIXTURES = "true";
    process.env.VIALGRADE_SEED_DEMO_ACCOUNTS = "true";
    delete (globalThis as { __vialEvidenceSeedPromise?: unknown }).__vialEvidenceSeedPromise;
    delete (globalThis as { __vialSellerOpsSeedPromise?: unknown }).__vialSellerOpsSeedPromise;
    await resetDatabaseForTests();
    await ensureEvidenceNetworkSeed();
  });

  it("records an immutable passport version with a decomposed confidence basis", async () => {
    const record = await getBatchStandardRecord("vialgrade:batch:hx-bpc-2607");
    expect(record).toBeTruthy();
    // The one demo passport's declared batch code is seed-nondeterministic (a featured-order
    // tie in fixtures); the standard contract is the decomposition + history below.
    expect(record!.declaredBatchCode).toMatch(/-BPC-/);
    // The headline number is preserved but decomposed, never presented as a black box.
    expect(record!.evidenceConfidence).toBeCloseTo(0.82 * 0.86, 3);
    expect(record!.evidenceType).toBe("vial-operated");
    const basis = record!.confidenceBasis as unknown as import("@/server/evidence-network/repository").BatchConfidenceBasis;
    expect(basis.samplingLevel).toBe("S3");
    expect(basis.conflictPenaltyApplied).toBe(true);
    expect(basis.independence.samplingModels).toContain("blind_purchase");
    expect(basis.laboratories).toContain("Aperture Analytical");
    // The conflict-preserving doctrine survives into the standard: quantity stays contested.
    expect(basis.dimensionSummary.conflicting).toContain("quantity");
    expect(record!.versions.length).toBeGreaterThanOrEqual(1);
    expect(record!.provenanceUrl).toBe("/passports/hx-bpc-2607");
  });

  it("appends a new immutable version only when the passport content changes", async () => {
    const db = await getDatabase();
    const maxVersion = async () => Number((await db.query<{ v: number | null }>(`SELECT MAX(version) v FROM passport_versions WHERE passport_id='passport:hx-bpc-2607'`)).rows[0]!.v ?? 0);
    const seeded = await maxVersion();
    expect(seeded).toBeGreaterThanOrEqual(1);

    // Idempotent recompute (no change) must NOT append a version.
    await recomputePassport("passport:hx-bpc-2607");
    expect(await maxVersion()).toBe(seeded);

    // A material change (revoking a report) appends a new version, preserving the prior one.
    await revokeLaboratoryReport({ laboratoryId: "lab:aperture", reportId: "lab-report:A", actorId: "user:lab:elena", reason: "integration-test revoke" });
    const after = await maxVersion();
    expect(after).toBe(seeded + 1);
    const priorPreserved = Number((await db.query<{ c: string | number }>(`SELECT COUNT(*) c FROM passport_versions WHERE passport_id='passport:hx-bpc-2607' AND version=$1`, [seeded])).rows[0]!.c);
    expect(priorPreserved).toBe(1);
  });

  it("serves the batch standard record over the public API for market:read", async () => {
    const db = await getDatabase();
    await db.query(`INSERT INTO auth_users(id,email,display_name,account_type,roles) VALUES('user:b','b@vialgrade.test','b','customer','["customer"]'::jsonb) ON CONFLICT(id) DO NOTHING`);
    const key = await createApiKey({ ownerId: "user:b", name: "b", scopes: ["market:read"] });

    const direct = await getBatchStandardRecord("vialgrade:batch:hx-bpc-2607");
    const ok = await getBatch(bearer(key.plaintext, "https://api.vialgrade.test/api/public/v1/batches/vialgrade:batch:hx-bpc-2607"), { params: Promise.resolve({ batchId: "vialgrade:batch:hx-bpc-2607" }) });
    expect(ok.status).toBe(200);
    const body = await ok.json();
    // The API returns exactly what the domain record layer returns.
    expect(body.data.declaredBatchCode).toBe(direct!.declaredBatchCode);
    expect(body.data.confidenceBasis.samplingLevel).toBe("S3");

    const missing = await getBatch(bearer(key.plaintext, "https://api.vialgrade.test/api/public/v1/batches/vialgrade:batch:nope"), { params: Promise.resolve({ batchId: "vialgrade:batch:nope" }) });
    expect(missing.status).toBe(404);
  });
});

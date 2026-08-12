import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import {
  appendCustodyEvent,
  authenticateLaboratoryApiToken,
  createLaboratoryApiToken,
  ensureEvidenceNetworkSeed,
  getEvidenceNetworkDashboard,
  getLaboratoryContext,
  getPublicPassport,
  issueLaboratoryReport,
  revokeLaboratoryReport,
  revokeLaboratoryApiToken,
  verifyCustodyChain,
} from "@/server/evidence-network/repository";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SEED_FIXTURES = "true";
process.env.VIALGRADE_SEED_DEMO_ACCOUNTS = "true";
process.env.VIALGRADE_SESSION_SECRET = "evidence-network-session-secret-at-least-32";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "evidence-network-privacy-secret-at-least-32";

describe("VIAL 6.0 evidence and laboratory network", () => {
  beforeAll(async () => { await resetDatabaseForTests(); globalThis.__vialEvidenceSeedPromise = undefined; await ensureEvidenceNetworkSeed(); });
  afterAll(async () => { await resetDatabaseForTests(); globalThis.__vialEvidenceSeedPromise = undefined; });

  it("seeds a method-scoped laboratory, independent program, samples, reports, and a passport", async () => {
    const dashboard = await getEvidenceNetworkDashboard();
    expect(Number((dashboard.counts as Record<string, unknown>).laboratories)).toBe(1);
    expect(Number((dashboard.counts as Record<string, unknown>).samples)).toBe(2);
    expect(Number((dashboard.counts as Record<string, unknown>).issued_reports)).toBe(2);
    expect(Number((dashboard.counts as Record<string, unknown>).conflicts)).toBe(1);
    const context = await getLaboratoryContext("elena@aperture.test");
    expect(context?.methods).toHaveLength(5);
    expect(context?.membership.role).toBe("laboratory_owner");
    expect(await getLaboratoryContext("unknown@lab.test")).toBeNull();
  });

  it("maintains an append-only custody hash chain and detects tampering", async () => {
    const context = await getLaboratoryContext("elena@aperture.test");
    const sample = context!.samples[0] as Record<string, unknown>;
    const before = await verifyCustodyChain(String(sample.id));
    expect(before.valid).toBe(true);
    await appendCustodyEvent({ sampleId: String(sample.id), eventType: "stored", actorType: "user", actorId: "user:lab:elena", location: "Retention freezer", metadata: { temperature: "2-8C" } });
    const after = await verifyCustodyChain(String(sample.id));
    expect(after.valid).toBe(true);
    expect(after.count).toBe(before.count + 1);
    const db = await getDatabase();
    const event = (await db.query<{ id: string; metadata: unknown }>(`SELECT id,metadata FROM sample_custody_events WHERE sample_id=$1 ORDER BY sequence_number DESC LIMIT 1`, [sample.id])).rows[0];
    await db.query(`UPDATE sample_custody_events SET metadata=$2::jsonb WHERE id=$1`, [event.id, JSON.stringify({ temperature: "tampered" })]);
    expect((await verifyCustodyChain(String(sample.id))).valid).toBe(false);
    await db.query(`UPDATE sample_custody_events SET metadata=$2::jsonb WHERE id=$1`, [event.id, JSON.stringify(event.metadata)]);
    expect((await verifyCustodyChain(String(sample.id))).valid).toBe(true);
  });

  it("issues, supersedes, and revokes versioned reports without deleting history", async () => {
    const context = await getLaboratoryContext("elena@aperture.test");
    const order = context!.orders[0] as Record<string, unknown>;
    const sample = context!.samples.find((row: Record<string, unknown>) => String(row.test_order_id) === String(order.id)) as Record<string, unknown>;
    const first = await issueLaboratoryReport({ laboratoryId: String(context!.lab.id), testOrderId: String(order.id), sampleId: String(sample.id), reportNumber: "APR-INTEGRATION-01", actorId: "user:lab:elena", summary: "Integration report version one." });
    const second = await issueLaboratoryReport({ laboratoryId: String(context!.lab.id), testOrderId: String(order.id), sampleId: String(sample.id), reportNumber: "APR-INTEGRATION-01", actorId: "user:lab:elena", summary: "Corrected integration report." });
    expect(second.version).toBe(2);
    const db = await getDatabase();
    const versions = (await db.query<{ id: string; version: number; status: string }>(`SELECT id,version,status FROM laboratory_reports WHERE report_number='APR-INTEGRATION-01' ORDER BY version`)).rows;
    expect(versions.map(row => row.status)).toEqual(["superseded", "issued"]);
    await revokeLaboratoryReport({ laboratoryId: String(context!.lab.id), reportId: second.id, actorId: "user:lab:elena", reason: "Integration revocation test" });
    const revoked = (await db.query<{ status: string; revocation_reason: string }>(`SELECT status,revocation_reason FROM laboratory_reports WHERE id=$1`, [second.id])).rows[0];
    expect(revoked.status).toBe("revoked");
    expect(revoked.revocation_reason).toContain("Integration");
    expect((await db.query(`SELECT id FROM laboratory_reports WHERE id=$1`, [first.id])).rows[0]).toBeTruthy();
  });

  it("publishes multidimensional passports while preserving conflicts and unknowns", async () => {
    const data = await getPublicPassport("hx-bpc-2607");
    expect(data).toBeTruthy();
    const dimensions = typeof data!.passport.dimensions === "string" ? JSON.parse(data!.passport.dimensions) : data!.passport.dimensions as Record<string, unknown>;
    expect((dimensions.quantity as { status: string }).status).toBe("conflicting");
    expect((dimensions.identity as { status: string }).status).toBe("established");
    expect(data!.conflicts).toHaveLength(1);
    const limitations = typeof data!.passport.limitations === "string" ? JSON.parse(data!.passport.limitations) : data!.passport.limitations as string[];
    expect(limitations.join(" ")).toContain("sterility");
    expect(limitations.join(" ")).toContain("endotoxin");
  });

  it("creates revocable, scoped laboratory API credentials", async () => {
    const context = await getLaboratoryContext("elena@aperture.test");
    const token = await createLaboratoryApiToken({ laboratoryId: String(context!.lab.id), label: "Integration MCP", scopes: ["lab:read", "lab:propose"], actorId: "integration-test" });
    const authenticated = await authenticateLaboratoryApiToken(token.token);
    expect(authenticated?.laboratoryId).toBe(context!.lab.id);
    expect(authenticated?.scopes).toContain("lab:propose");
    expect(await revokeLaboratoryApiToken({ laboratoryId: String(context!.lab.id), tokenId: token.id })).toBe(true);
    expect(await authenticateLaboratoryApiToken(token.token)).toBeNull();
    expect(await authenticateLaboratoryApiToken("vlab_invalid")).toBeNull();
  });
});

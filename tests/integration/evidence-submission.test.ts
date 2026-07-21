import { beforeEach, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { ensureEvidenceNetworkSeed, createLaboratoryApiToken } from "@/server/evidence-network/repository";
import { POST as postProposal } from "@/app/api/public/v1/id/[vialId]/evidence-proposals/route";

function req(token: string | null, vialId: string, body: unknown) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request(`https://api.vial.test/api/public/v1/id/${vialId}/evidence-proposals`, { method: "POST", headers, body: JSON.stringify(body) });
}
const params = (vialId: string) => ({ params: Promise.resolve({ vialId }) });

describe("VIAL 10.0 external evidence submission (proposal-only)", () => {
  beforeEach(async () => {
    process.env.VIAL_PGLITE_MEMORY = "true";
    process.env.VIAL_SEED_FIXTURES = "true";
    process.env.VIAL_SEED_DEMO_ACCOUNTS = "true";
    delete (globalThis as { __vialEvidenceSeedPromise?: unknown }).__vialEvidenceSeedPromise;
    delete (globalThis as { __vialSellerOpsSeedPromise?: unknown }).__vialSellerOpsSeedPromise;
    await resetDatabaseForTests();
    await ensureEvidenceNetworkSeed();
  });

  it("accepts a lab-token evidence proposal against a batch VIAL ID and lands it in review — never published", async () => {
    const token = await createLaboratoryApiToken({ laboratoryId: "lab:aperture", label: "api", scopes: ["evidence:propose"], actorId: "user:lab:elena" });
    const res = await postProposal(req(token.token, "vial:batch:hx-bpc-2607", { proposalType: "evidence-link", payload: { reportNumber: "APR-2607-999", note: "corroborating third sample" } }), params("vial:batch:hx-bpc-2607"));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.status).toBe("pending");

    const db = await getDatabase();
    const row = (await db.query<{ status: string; subject_type: string; subject_id: string; laboratory_id: string }>(`SELECT status,subject_type,subject_id,laboratory_id FROM laboratory_work_proposals WHERE id=$1`, [body.data.id])).rows[0];
    expect(row.status).toBe("pending");
    expect(row.laboratory_id).toBe("lab:aperture");
    expect(row.subject_type).toBe("batch_passport"); // resolved to the real passport, not a string

    // Boundary: the bearer path can NEVER produce an issued/approved/published record.
    const published = Number((await db.query<{ c: string | number }>(`SELECT COUNT(*) c FROM laboratory_work_proposals WHERE status IN ('issued','approved','published')`)).rows[0]!.c);
    expect(published).toBe(0);
  });

  it("rejects an unauthenticated token (401) and a token without evidence:propose scope (403)", async () => {
    const noAuth = await postProposal(req(null, "vial:batch:hx-bpc-2607", { proposalType: "evidence-link", payload: {} }), params("vial:batch:hx-bpc-2607"));
    expect(noAuth.status).toBe(401);

    const wrongScope = await createLaboratoryApiToken({ laboratoryId: "lab:aperture", label: "ro", scopes: ["reports:read"], actorId: "user:lab:elena" });
    const forbidden = await postProposal(req(wrongScope.token, "vial:batch:hx-bpc-2607", { proposalType: "evidence-link", payload: {} }), params("vial:batch:hx-bpc-2607"));
    expect(forbidden.status).toBe(403);
  });

  it("returns 404 for an unknown VIAL ID and 400 for a disallowed proposal type", async () => {
    const token = await createLaboratoryApiToken({ laboratoryId: "lab:aperture", label: "api", scopes: ["evidence:propose"], actorId: "user:lab:elena" });
    const missing = await postProposal(req(token.token, "vial:batch:ghost", { proposalType: "evidence-link", payload: {} }), params("vial:batch:ghost"));
    expect(missing.status).toBe(404);

    const badType = await postProposal(req(token.token, "vial:batch:hx-bpc-2607", { proposalType: "publish-now", payload: {} }), params("vial:batch:hx-bpc-2607"));
    expect(badType.status).toBe(400);
  });
});

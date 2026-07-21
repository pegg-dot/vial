import { beforeEach, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { createApiKey } from "@/server/api-access/keys";
import { ensureEvidenceNetworkSeed } from "@/server/evidence-network/repository";
import { getVendorReputationBySlug, getReputationRecord } from "@/server/reputation/repository";
import { GET as getReputation } from "@/app/api/public/v1/reputation/[vialId]/route";

const bearer = (token: string, url: string) => new Request(url, { headers: { authorization: `Bearer ${token}` } });

describe("VIAL 10.0 reputation records", () => {
  beforeEach(async () => {
    process.env.VIAL_PGLITE_MEMORY = "true";
    process.env.VIAL_SEED_FIXTURES = "true";
    process.env.VIAL_SEED_DEMO_ACCOUNTS = "true";
    delete (globalThis as { __vialEvidenceSeedPromise?: unknown }).__vialEvidenceSeedPromise;
    delete (globalThis as { __vialSellerOpsSeedPromise?: unknown }).__vialSellerOpsSeedPromise;
    await resetDatabaseForTests();
  });

  it("composes a decomposable vendor reputation record with no black-box score", async () => {
    const record = await getVendorReputationBySlug("northstar-research");
    expect(record).toBeTruthy();
    expect(record!.subjectType).toBe("vendor");
    expect(record!.methodologyVersion).toBe("reputation-v1");
    // The category doctrine: a reputation record is NEVER a composite number.
    expect("score" in record!).toBe(false);
    expect("overallScore" in record!).toBe(false);
    expect("rating" in record!).toBe(false);

    const byKey = Object.fromEntries(record!.dimensions.map(d => [d.key, d]));
    expect(byKey.identity_claim.status).toBe("established");
    expect(byKey.documentation_currency.status).toBe("established");
    expect(typeof byKey.documentation_currency.numericValue).toBe("number");
    // The fabricated support/shipping scores are replaced by an honest "unknown" when the
    // vendor does not operate a participating storefront with real operational analytics.
    expect(byKey.operational_reliability.status).toBe("unknown");

    // Every dimension is provenance-linked and explains its basis — nothing is a black box.
    for (const d of record!.dimensions) {
      expect(d.provenance).toBeTruthy();
      expect(d.basis.length).toBeGreaterThan(0);
      expect(["established", "unknown", "disputed"]).toContain(d.status);
    }
  });

  it("composes a lab integrity record from real report, method, and custody counts", async () => {
    await ensureEvidenceNetworkSeed();
    const record = await getReputationRecord("vial:lab:aperture-analytical");
    expect(record).toBeTruthy();
    expect(record!.subjectType).toBe("lab");
    expect("score" in record!).toBe(false);
    const byKey = Object.fromEntries(record!.dimensions.map(d => [d.key, d]));
    expect(byKey.report_integrity.status).toBe("established");
    expect(byKey.accreditation).toBeTruthy();
    expect(byKey.method_coverage).toBeTruthy();
  });

  it("serves the reputation record over the public API for reputation:read", async () => {
    const db = await getDatabase();
    await db.query(`INSERT INTO auth_users(id,email,display_name,account_type,roles) VALUES('user:rep','rep@vial.test','rep','customer','["customer"]'::jsonb) ON CONFLICT(id) DO NOTHING`);
    const key = await createApiKey({ ownerId: "user:rep", name: "rep", scopes: ["reputation:read"] });
    const wrongKey = await createApiKey({ ownerId: "user:rep", name: "m", scopes: ["market:read"] });

    const ok = await getReputation(bearer(key.plaintext, "https://api.vial.test/api/public/v1/reputation/vial:vendor:northstar-research"), { params: Promise.resolve({ vialId: "vial:vendor:northstar-research" }) });
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.data.subjectType).toBe("vendor");
    expect(Array.isArray(body.data.dimensions)).toBe(true);

    const forbidden = await getReputation(bearer(wrongKey.plaintext, "https://api.vial.test/api/public/v1/reputation/vial:vendor:northstar-research"), { params: Promise.resolve({ vialId: "vial:vendor:northstar-research" }) });
    expect(forbidden.status).toBe(403);

    const missing = await getReputation(bearer(key.plaintext, "https://api.vial.test/api/public/v1/reputation/vial:vendor:ghost"), { params: Promise.resolve({ vialId: "vial:vendor:ghost" }) });
    expect(missing.status).toBe(404);
  });
});

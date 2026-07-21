import { beforeEach, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { createApiKey } from "@/server/api-access/keys";
import { GET as getById } from "@/app/api/public/v1/id/[vialId]/route";
import { GET as getResolve } from "@/app/api/public/v1/resolve/route";

const bearer = (token: string, url: string) => new Request(url, { headers: { authorization: `Bearer ${token}` } });

describe("VIAL 10.0 registry public API", () => {
  beforeEach(async () => {
    process.env.VIAL_PGLITE_MEMORY = "true";
    process.env.VIAL_SEED_FIXTURES = "true";
    process.env.VIAL_SEED_DEMO_ACCOUNTS = "true";
    await resetDatabaseForTests();
    const db = await getDatabase();
    await db.query(`INSERT INTO auth_users(id,email,display_name,account_type,roles) VALUES('user:reg','reg@vial.test','reg','customer','["customer"]'::jsonb) ON CONFLICT(id) DO NOTHING`);
  });

  it("resolves a VIAL ID to its record for a key with identity:read", async () => {
    const key = await createApiKey({ ownerId: "user:reg", name: "id", scopes: ["identity:read"] });
    const res = await getById(bearer(key.plaintext, "https://api.vial.test/api/public/v1/id/vial:compound:bpc-157"), { params: Promise.resolve({ vialId: "vial:compound:bpc-157" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.vialId).toBe("vial:compound:bpc-157");
    expect(body.data.provenanceUrl).toBe("/compounds/bpc-157");
  });

  it("rejects a key that lacks identity:read with 403", async () => {
    const key = await createApiKey({ ownerId: "user:reg", name: "m", scopes: ["market:read"] });
    const res = await getById(bearer(key.plaintext, "https://api.vial.test/api/public/v1/id/vial:compound:bpc-157"), { params: Promise.resolve({ vialId: "vial:compound:bpc-157" }) });
    expect(res.status).toBe(403);
  });

  it("returns 404 for an unknown VIAL ID", async () => {
    const key = await createApiKey({ ownerId: "user:reg", name: "id", scopes: ["identity:read"] });
    const res = await getById(bearer(key.plaintext, "https://api.vial.test/api/public/v1/id/vial:compound:nonexistent"), { params: Promise.resolve({ vialId: "vial:compound:nonexistent" }) });
    expect(res.status).toBe(404);
  });

  it("resolves a messy label through the resolve endpoint", async () => {
    const key = await createApiKey({ ownerId: "user:reg", name: "id", scopes: ["identity:read"] });
    const res = await getResolve(bearer(key.plaintext, "https://api.vial.test/api/public/v1/resolve?label=BPC157&type=compound"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.best.vialId).toBe("vial:compound:bpc-157");
  });
});

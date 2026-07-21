import { beforeEach, describe, expect, it } from "vitest";
import { getDatabase } from "@/server/db/client";
import { createApiKey, resolveApiKey, revokeApiKey, listApiKeys } from "@/server/api-access/keys";
import { requireApiKey } from "@/server/api-access/bearer";

async function seedUser(id: string, email: string) {
  const db = await getDatabase();
  await db.query(`INSERT INTO auth_users(id,email,display_name,account_type,roles) VALUES($1,$2,$3,'customer','["customer"]'::jsonb) ON CONFLICT(id) DO NOTHING`, [id, email, email]);
}
const bearer = (token: string) => new Request("https://api.vial.test/x", { headers: { authorization: `Bearer ${token}` } });

describe("programmatic API access", () => {
  beforeEach(async () => {
    process.env.VIAL_PGLITE_MEMORY = "true";
    delete (globalThis as { __vialDbPromise?: unknown }).__vialDbPromise;
    await seedUser("user:a", "a@vial.test"); await seedUser("user:b", "b@vial.test");
  });

  it("issues a key whose plaintext resolves, storing only the hash", async () => {
    const issued = await createApiKey({ ownerId: "user:a", name: "reporting", scopes: ["market:read", "export:read"] });
    expect(issued.plaintext).toMatch(/^vial_pk_/);
    const resolved = await resolveApiKey(issued.plaintext);
    expect(resolved).toMatchObject({ id: issued.id, ownerId: "user:a", scopes: ["market:read", "export:read"] });
    // The plaintext is never persisted — the listing shows only a prefix.
    const listed = await listApiKeys("user:a");
    expect(listed[0].key_prefix).toBe(issued.prefix);
    expect(JSON.stringify(listed)).not.toContain(issued.plaintext);
  });

  it("rejects a revoked key and an expired key", async () => {
    const revoked = await createApiKey({ ownerId: "user:a", name: "r", scopes: ["market:read"] });
    expect(await revokeApiKey("user:a", revoked.id)).toBe(true);
    expect(await resolveApiKey(revoked.plaintext)).toBeNull();

    const expired = await createApiKey({ ownerId: "user:a", name: "e", scopes: ["market:read"], expiresAt: new Date(Date.now() - 1000) });
    expect(await resolveApiKey(expired.plaintext)).toBeNull();
  });

  it("owner-scoped revoke: user B cannot revoke user A's key", async () => {
    const issued = await createApiKey({ ownerId: "user:a", name: "k", scopes: ["market:read"] });
    expect(await revokeApiKey("user:b", issued.id)).toBe(false);
    expect(await resolveApiKey(issued.plaintext)).not.toBeNull();
  });

  it("requireApiKey enforces bearer, scope, and returns owner access", async () => {
    const issued = await createApiKey({ ownerId: "user:a", name: "k", scopes: ["market:read"] });
    expect((await requireApiKey(new Request("https://api.vial.test/x"), "market:read")).response?.status).toBe(401);
    expect((await requireApiKey(bearer("vial_pk_bogus"), "market:read")).response?.status).toBe(401);
    expect((await requireApiKey(bearer(issued.plaintext), "signals:read")).response?.status).toBe(403);
    const ok = await requireApiKey(bearer(issued.plaintext), "market:read");
    expect(ok.access?.ownerId).toBe("user:a");
  });
});

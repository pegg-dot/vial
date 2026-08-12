import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.VIALGRADE_PGLITE_MEMORY = "true";

type Mods = {
  getDatabase: typeof import("@/server/db/client").getDatabase;
  registerCustomer: typeof import("@/server/auth/register").registerCustomer;
  authenticateCredentials: typeof import("@/server/auth/authenticate").authenticateCredentials;
};

const ctx = { requestId: "req-test", ipHash: "ip-test-unique", userAgentHash: "ua-test" };

describe("buyer self-serve registration", () => {
  let m: Mods;

  beforeAll(async () => {
    (globalThis as typeof globalThis & { __vialDbPromise?: unknown }).__vialDbPromise = undefined;
    const [client, register, authenticate] = await Promise.all([
      import("@/server/db/client"),
      import("@/server/auth/register"),
      import("@/server/auth/authenticate"),
    ]);
    m = { getDatabase: client.getDatabase, registerCustomer: register.registerCustomer, authenticateCredentials: authenticate.authenticateCredentials };
    await m.getDatabase();
  });

  afterAll(async () => {
    const { resetDatabaseForTests } = await import("@/server/db/client");
    await resetDatabaseForTests();
  });

  it("creates a customer account that can then log in", async () => {
    const result = await m.registerCustomer({ email: "newbuyer@example.test", password: "correct-horse-battery", displayName: "New Buyer" }, ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.principal.accountType).toBe("customer");
    expect(result.principal.roles).toEqual(["customer"]);

    // The new credentials actually authenticate.
    const login = await m.authenticateCredentials({ email: "newbuyer@example.test", password: "correct-horse-battery" }, { ...ctx, requestId: "req-2" });
    expect(login.ok).toBe(true);
  });

  it("only ever mints a customer — never a seller/lab/staff", async () => {
    const result = await m.registerCustomer({ email: "another@example.test", password: "another-strong-pass", displayName: "Another" }, { ...ctx, ipHash: "ip-2" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const db = await m.getDatabase();
    const row = await db.query<{ account_type: string }>(`SELECT account_type FROM auth_users WHERE email='another@example.test'`);
    expect(row.rows[0]?.account_type).toBe("customer");
  });

  it("rejects a weak password, a bad email, and a duplicate", async () => {
    expect((await m.registerCustomer({ email: "x@example.test", password: "short", displayName: "X" }, { ...ctx, ipHash: "ip-3" })).ok).toBe(false);
    expect((await m.registerCustomer({ email: "not-an-email", password: "long-enough-pass", displayName: "Y" }, { ...ctx, ipHash: "ip-4" })).ok).toBe(false);
    const dup = await m.registerCustomer({ email: "newbuyer@example.test", password: "correct-horse-battery", displayName: "Dup" }, { ...ctx, ipHash: "ip-5" });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.status).toBe(409);
  });
});

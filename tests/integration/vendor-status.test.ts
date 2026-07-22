import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { recordVendorStatus, getVendorStatus } from "@/server/verify/vendor-status";

process.env.VIAL_PGLITE_MEMORY = "true";
process.env.VIAL_SESSION_SECRET = "vendor-status-test-secret-at-least-32-characters";
process.env.VIAL_PRIVACY_HASH_SECRET = "vendor-status-privacy-secret-at-least-32-characters";

describe("vendor status store", () => {
  beforeAll(async () => { await resetDatabaseForTests(); await getDatabase(); });
  afterAll(async () => { await resetDatabaseForTests(); });

  it("stores and reads a status, upserting one row per vendor", async () => {
    const db = await getDatabase();
    await recordVendorStatus(db, "acme", { status: "operating", httpCode: 200, redirectHost: null, detail: "up" });
    expect((await getVendorStatus(db, "acme"))?.status).toBe("operating");
    // a later probe finds it dark → upsert
    await recordVendorStatus(db, "acme", { status: "offline", httpCode: null, redirectHost: null, detail: "down" });
    const s = await getVendorStatus(db, "acme");
    expect(s?.status).toBe("offline");
    expect((await db.query(`SELECT COUNT(*) n FROM vendor_status WHERE vendor_slug='acme'`)).rows[0].n).toBe(1);
  });

  it("keeps the redirect host for a redirected vendor", async () => {
    const db = await getDatabase();
    await recordVendorStatus(db, "moved", { status: "redirected", httpCode: 200, redirectHost: "newbrand.com", detail: "moved" });
    expect((await getVendorStatus(db, "moved"))?.redirectHost).toBe("newbrand.com");
  });

  it("returns null for an unprobed vendor", async () => {
    expect(await getVendorStatus(await getDatabase(), "ghost")).toBeNull();
  });
});

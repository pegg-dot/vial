import { beforeEach, describe, expect, it } from "vitest";
import { getDatabase } from "@/server/db/client";
import { ensureInternalOpsSeed } from "@/server/internal-ops/repository";
import { assertLiveCommerceEnabled, isFeatureFlagEnabled } from "@/server/commerce/production-gate";

describe("commerce production flag interlock", () => {
  beforeEach(() => { process.env.VIALGRADE_PGLITE_MEMORY = "true"; delete (globalThis as { __vialDbPromise?: unknown }).__vialDbPromise; delete (globalThis as { __vialInternalSeedPromise?: unknown }).__vialInternalSeedPromise; });

  it("seeds the commerce_production hard stop disabled and reflects toggles", async () => {
    await ensureInternalOpsSeed();
    const db = await getDatabase();
    expect(await isFeatureFlagEnabled(db, "commerce_production")).toBe(false);
    await db.query(`UPDATE feature_flags SET enabled = true WHERE key = 'commerce_production'`);
    expect(await isFeatureFlagEnabled(db, "commerce_production")).toBe(true);
  });

  it("fails closed: a missing flag reads as disabled so live charges stay blocked", async () => {
    const db = await getDatabase();
    // Internal-ops not yet seeded — the flag row does not exist.
    expect(await isFeatureFlagEnabled(db, "commerce_production")).toBe(false);
  });

  it("no-ops the live-commerce guard in the default sandbox configuration", async () => {
    const db = await getDatabase();
    // Default env is sandbox/mock — the guard must not block ordinary sandbox checkout.
    await expect(assertLiveCommerceEnabled(db)).resolves.toBeUndefined();
  });
});

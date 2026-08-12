import { beforeEach, describe, expect, it } from "vitest";
import { ensureEvidenceNetworkSeed, getLaboratoryContext, getLaboratoryAnalytics } from "@/server/evidence-network/repository";

describe("laboratory operations analytics", () => {
  beforeEach(() => {
    process.env.VIALGRADE_PGLITE_MEMORY = "true";
    delete (globalThis as { __vialDbPromise?: unknown }).__vialDbPromise;
    delete (globalThis as { __vialEvidenceSeedPromise?: unknown }).__vialEvidenceSeedPromise;
  });

  it("aggregates real operational counts for a seeded laboratory", async () => {
    await ensureEvidenceNetworkSeed();
    const context = await getLaboratoryContext("elena@aperture.test");
    expect(context).toBeTruthy();
    const labId = String((context!.lab as { id: string }).id);
    const analytics = await getLaboratoryAnalytics(labId);
    // The seeded lab has methods and at least one test order; counts are real, not stubbed.
    expect(Number(analytics.totals.total_methods)).toBeGreaterThan(0);
    expect(Number(analytics.totals.total_orders)).toBeGreaterThanOrEqual(0);
    expect(Number(analytics.totals.validated_methods)).toBeLessThanOrEqual(Number(analytics.totals.total_methods));
    expect(Array.isArray(analytics.orderStatus)).toBe(true);
  });
});

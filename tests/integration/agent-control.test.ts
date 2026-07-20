import { beforeEach, describe, expect, it } from "vitest";
import { ensureAgentControlSeed, getExtractionControlPlane } from "@/server/agents/control-repository";

describe("agent control-plane repository", () => {
  beforeEach(() => {
    process.env.VIAL_PGLITE_MEMORY = "true";
    delete (globalThis as { __vialDbPromise?: unknown }).__vialDbPromise;
    delete (globalThis as { __vialAgentControlSeed?: unknown }).__vialAgentControlSeed;
  });

  it("seeds and persists the deterministic baseline benchmark", async () => {
    await ensureAgentControlSeed();
    const plane = await getExtractionControlPlane();
    expect(plane.latestBaseline).toBeTruthy();
    // The honest baseline established in Part A: F1 ≈ 0.909.
    expect(Number(plane.latestBaseline!.f1)).toBeCloseTo(0.909, 2);
    expect(Number(plane.latestBaseline!.precision)).toBe(1);
    // The three hard cases show up as recorded false-negatives (the model's target).
    const hardMisses = plane.caseResults.filter((c) => c.difficulty === "hard" && Number(c.false_negatives) > 0);
    expect(hardMisses.length).toBeGreaterThanOrEqual(3);
    // A default authoritative activation is recorded, and no model run exists yet.
    expect(plane.activations.some((a) => a.extractor_id === "deterministic-v2")).toBe(true);
    expect(plane.modelRuns).toHaveLength(0);
  });

  it("is idempotent — does not duplicate the baseline", async () => {
    await ensureAgentControlSeed();
    await ensureAgentControlSeed();
    const plane = await getExtractionControlPlane();
    expect(plane.runs.filter((r) => r.is_baseline).length).toBe(1);
  });
});

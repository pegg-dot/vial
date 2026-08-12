import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.VIALGRADE_PGLITE_MEMORY = "true";

type Modules = {
  getDatabase: typeof import("@/server/db/client").getDatabase;
  getRefreshPolicies: typeof import("@/server/refresh/repository").getRefreshPolicies;
  advanceFixture: typeof import("@/server/refresh/repository").advanceFixture;
  createRefreshJob: typeof import("@/server/refresh/repository").createRefreshJob;
  processRefreshJob: typeof import("@/server/refresh/scheduler").processRefreshJob;
  runRefreshSweep: typeof import("@/server/refresh/scheduler").runRefreshSweep;
  getPendingClaims: typeof import("@/server/review/repository").getPendingClaims;
  reviewClaim: typeof import("@/server/review/repository").reviewClaim;
  getTraceRoots: typeof import("@/server/intelligence/repository").getTraceRoots;
  getOpportunitySignals: typeof import("@/server/intelligence/repository").getOpportunitySignals;
  getAlertsForListingSlugs: typeof import("@/server/intelligence/repository").getAlertsForListingSlugs;
  runIntelligenceSweep: typeof import("@/server/intelligence/scanner").runIntelligenceSweep;
};

describe("controlled refresh and cascading lineage", () => {
  let modules: Modules;

  beforeAll(async () => {
    (globalThis as typeof globalThis & { __vialDbPromise?: unknown }).__vialDbPromise = undefined;
    const database = await import("@/server/db/client");
    const refreshRepository = await import("@/server/refresh/repository");
    const scheduler = await import("@/server/refresh/scheduler");
    const review = await import("@/server/review/repository");
    const intelligence = await import("@/server/intelligence/repository");
    const scanner = await import("@/server/intelligence/scanner");
    modules = {
      getDatabase: database.getDatabase,
      getRefreshPolicies: refreshRepository.getRefreshPolicies,
      advanceFixture: refreshRepository.advanceFixture,
      createRefreshJob: refreshRepository.createRefreshJob,
      processRefreshJob: scheduler.processRefreshJob,
      runRefreshSweep: scheduler.runRefreshSweep,
      getPendingClaims: review.getPendingClaims,
      reviewClaim: review.reviewClaim,
      getTraceRoots: intelligence.getTraceRoots,
      getOpportunitySignals: intelligence.getOpportunitySignals,
      getAlertsForListingSlugs: intelligence.getAlertsForListingSlugs,
      runIntelligenceSweep: scanner.runIntelligenceSweep,
    };
  });

  afterAll(async () => {
    const database = await modules.getDatabase();
    await database.close();
    (globalThis as typeof globalThis & { __vialDbPromise?: unknown }).__vialDbPromise = undefined;
  });

  it("carries one trace from fixture mutation through publication, metrics, alerts, and opportunities", async () => {
    const policy = (await modules.getRefreshPolicies()).find((item) => item.targetListingSlug === "meridian-bpc-157-5mg");
    if (!policy) throw new Error("Expected Meridian controlled fixture policy");

    const advanced = await modules.advanceFixture(policy.id, "test:admin");
    const refreshed = await modules.processRefreshJob(advanced.jobId);
    expect(refreshed.status).toBe("succeeded");
    if (!("runId" in refreshed)) throw new Error("Expected a successful pipeline result");

    const batchClaim = (await modules.getPendingClaims()).find((claim) => claim.runId === refreshed.runId && claim.predicate === "batchCode");
    expect(batchClaim?.proposedValue).toBe("MB-BPC-0719");
    if (!batchClaim) throw new Error("Expected a batch-code claim");

    const publication = await modules.reviewClaim({
      claimId: batchClaim.id,
      decision: "approve",
      actor: "test:admin",
      role: "admin",
    });
    expect(publication.status).toBe("published");
    if (publication.status !== "published") throw new Error("Expected a published claim");
    expect(publication.cascade.rootEventId).toBe(advanced.rootEventId);

    const trace = (await modules.getTraceRoots(50)).find((item) => item.id === advanced.rootEventId);
    expect(trace).toBeTruthy();
    const eventTypes = trace?.events.map((event) => event.eventType) ?? [];
    expect(eventTypes).toEqual(expect.arrayContaining([
      "source.fixture.advanced",
      "source.refresh.started",
      "source.refresh.succeeded",
      "listing.batchCode.published",
      "compound.metrics.recalculated",
      "vendor.metrics.recalculated",
      "alert.generated",
      "opportunity.opened",
    ]));

    const alerts = await modules.getAlertsForListingSlugs(["meridian-bpc-157-5mg"]);
    expect(alerts.some((alert) => alert.category === "batch-change")).toBe(true);

    const opportunities = await modules.getOpportunitySignals({ status: "all" });
    expect(opportunities.some((signal) => signal.signalType === "new-batch-evidence" && signal.rootEventId === advanced.rootEventId)).toBe(true);

    const sweep = await modules.runIntelligenceSweep("test:scanner");
    expect(sweep.evaluated).toBeGreaterThan(20);
    expect(sweep.emitted).toBeGreaterThan(0);
  });

  it("claims a scheduled job once and preserves a single attempt receipt", async () => {
    const database = await modules.getDatabase();
    await database.query(`UPDATE source_refresh_policies SET next_run_at = NOW() + INTERVAL '1 day'`);
    const policy = (await modules.getRefreshPolicies()).find((item) => item.targetListingSlug === "northstar-bpc-157-10mg");
    if (!policy) throw new Error("Expected Northstar controlled fixture policy");

    const jobId = await modules.createRefreshJob({
      policyId: policy.id,
      triggerType: "integration-sweep",
      createdBy: "test:scheduler",
      idempotencyKey: `${policy.id}:integration-sweep`,
      priority: 1,
    });
    const sweep = await modules.runRefreshSweep(1);
    expect(sweep.processed).toBe(1);
    expect(sweep.results[0]).toMatchObject({ jobId, status: "succeeded" });

    const job = await database.query<{ attempt_count: number; status: string }>(
      `SELECT attempt_count, status FROM refresh_jobs WHERE id = $1`,
      [jobId],
    );
    const attempts = await database.query<{ count: string | number }>(
      `SELECT COUNT(*) AS count FROM refresh_attempts WHERE job_id = $1`,
      [jobId],
    );
    expect(Number(job.rows[0]?.attempt_count)).toBe(1);
    expect(job.rows[0]?.status).toBe("succeeded");
    expect(Number(attempts.rows[0]?.count)).toBe(1);
  });
});

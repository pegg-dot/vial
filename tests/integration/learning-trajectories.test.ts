import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.VIALGRADE_PGLITE_MEMORY = "true";

type Modules = {
  runSourceIngestion: typeof import("@/server/agents/pipeline").runSourceIngestion;
  getPendingClaims: typeof import("@/server/review/repository").getPendingClaims;
  reviewClaim: typeof import("@/server/review/repository").reviewClaim;
  getEvidenceLearningTrajectory: typeof import("@/server/intelligence/learning-trajectories").getEvidenceLearningTrajectory;
  listVerifiedDiscrepancies: typeof import("@/server/intelligence/learning-trajectories").listVerifiedDiscrepancies;
  getEvidenceLearningSummary: typeof import("@/server/intelligence/learning-trajectories").getEvidenceLearningSummary;
  getDatabase: typeof import("@/server/db/client").getDatabase;
};

const sourceHtml = `<html>
  <head>
    <script type="application/ld+json">
      {"@type":"Product","offers":{"price":"62.00","availability":"https://schema.org/InStock"}}
    </script>
  </head>
  <body>
    <p>Shipping: same day by carrier pigeon.</p>
    <p>Batch: LEARN-TRACE-1</p>
    <p>Report date: October 12, 2026</p>
    <p>Report issuer: Learning Lab</p>
  </body>
</html>`;

describe("evidence learning trajectories", () => {
  let modules: Modules;

  beforeAll(async () => {
    (globalThis as typeof globalThis & { __vialDbPromise?: unknown }).__vialDbPromise = undefined;
    const [pipeline, review, learning, database] = await Promise.all([
      import("@/server/agents/pipeline"),
      import("@/server/review/repository"),
      import("@/server/intelligence/learning-trajectories"),
      import("@/server/db/client"),
    ]);
    modules = {
      runSourceIngestion: pipeline.runSourceIngestion,
      getPendingClaims: review.getPendingClaims,
      reviewClaim: review.reviewClaim,
      getEvidenceLearningTrajectory: learning.getEvidenceLearningTrajectory,
      listVerifiedDiscrepancies: learning.listVerifiedDiscrepancies,
      getEvidenceLearningSummary: learning.getEvidenceLearningSummary,
      getDatabase: database.getDatabase,
    };
  });

  afterAll(async () => {
    const database = await modules.getDatabase();
    await database.close();
    (globalThis as typeof globalThis & { __vialDbPromise?: unknown }).__vialDbPromise = undefined;
  });

  it("turns approval and rejection into reusable source-to-outcome trajectories", async () => {
    const run = await modules.runSourceIngestion({
      sourceType: "vendor-page",
      canonicalLocation: "https://example.invalid/learning/helix-bpc-157-10mg",
      label: "Learning trajectory fixture",
      targetListingSlug: "helix-bpc-157-10mg",
      rawContent: sourceHtml,
      contentType: "text/html",
      actor: "test:learning-trajectory",
    });

    const pending = (await modules.getPendingClaims()).filter((claim) => claim.runId === run.runId);
    const priceClaim = pending.find((claim) => claim.predicate === "price");
    const rejectedClaim = pending.find((claim) => claim.id !== priceClaim?.id);
    if (!priceClaim || !rejectedClaim) throw new Error("Expected at least two proposed claims");

    await modules.reviewClaim({
      claimId: priceClaim.id,
      decision: "approve",
      actor: "test:admin",
      role: "admin",
      notes: "Accepted after source review",
    });
    await modules.reviewClaim({
      claimId: rejectedClaim.id,
      decision: "reject",
      actor: "test:admin",
      role: "admin",
      notes: "Rejected because this source wording is not acceptable evidence for the public field",
    });

    const accepted = await modules.getEvidenceLearningTrajectory(priceClaim.id);
    expect(accepted).toMatchObject({
      claimId: priceClaim.id,
      state: "accepted",
      isVerifiedDiscrepancy: false,
      proposal: {
        runId: run.runId,
        predicate: "price",
        proposedValue: 62,
      },
      review: { decision: "approve" },
    });
    expect(accepted?.source.snapshotId).toBe(priceClaim.snapshotId);
    expect(accepted?.publication?.rootEventId).toBeTruthy();
    expect(accepted?.lineage.some((event) => event.eventType === "listing.price.published")).toBe(true);

    const rejected = await modules.getEvidenceLearningTrajectory(rejectedClaim.id);
    expect(rejected).toMatchObject({
      claimId: rejectedClaim.id,
      state: "rejected-proposal",
      isVerifiedDiscrepancy: true,
      proposal: {
        runId: run.runId,
        predicate: rejectedClaim.predicate,
      },
      review: { decision: "reject" },
      publication: null,
    });

    const discrepancies = await modules.listVerifiedDiscrepancies(20);
    expect(discrepancies.some((item) => item.claimId === rejectedClaim.id)).toBe(true);
    expect(discrepancies.some((item) => item.claimId === priceClaim.id)).toBe(false);

    const summary = await modules.getEvidenceLearningSummary();
    expect(summary.totals.accepted).toBeGreaterThanOrEqual(1);
    expect(summary.totals.rejected).toBeGreaterThanOrEqual(1);
    expect(summary.byPredicate.some((row) => row.predicate === rejectedClaim.predicate && row.rejected >= 1)).toBe(true);
    expect(summary.byWorkflow.some((row) => row.total > 0)).toBe(true);
  });
});

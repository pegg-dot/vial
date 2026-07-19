import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.VIAL_PGLITE_MEMORY = "true";

type Modules = {
  runSourceIngestion: typeof import("@/server/agents/pipeline").runSourceIngestion;
  getPendingClaims: typeof import("@/server/review/repository").getPendingClaims;
  getPublicationRecords: typeof import("@/server/review/repository").getPublicationRecords;
  reviewClaim: typeof import("@/server/review/repository").reviewClaim;
  getProductBySlug: typeof import("@/server/catalog/repository").getProductBySlug;
  getDatabase: typeof import("@/server/db/client").getDatabase;
};

const sourceHtml = `<html><head><script type="application/ld+json">{"@type":"Product","offers":{"price":"63.00","availability":"https://schema.org/InStock"}}</script></head><body><p>Shipping: 2-4 business days.</p><p>Batch: NS-BPC-INTEGRATION</p><p>Report date: July 19, 2026</p><p>Report issuer: Aperture Analytical</p><p>Report confirmed: yes</p></body></html>`;

describe("source-to-publication transaction", () => {
  let modules: Modules;

  beforeAll(async () => {
    (globalThis as typeof globalThis & { __vialDbPromise?: unknown }).__vialDbPromise = undefined;
    const pipeline = await import("@/server/agents/pipeline");
    const review = await import("@/server/review/repository");
    const catalog = await import("@/server/catalog/repository");
    const database = await import("@/server/db/client");
    modules = {
      runSourceIngestion: pipeline.runSourceIngestion,
      getPendingClaims: review.getPendingClaims,
      getPublicationRecords: review.getPublicationRecords,
      reviewClaim: review.reviewClaim,
      getProductBySlug: catalog.getProductBySlug,
      getDatabase: database.getDatabase,
    };
  });

  afterAll(async () => {
    const database = await modules.getDatabase();
    await database.close();
    (globalThis as typeof globalThis & { __vialDbPromise?: unknown }).__vialDbPromise = undefined;
  });

  it("is idempotent, enforces the high-impact gate, and publishes one atomic claim", async () => {
    const input = {
      sourceType: "vendor-page" as const,
      canonicalLocation: "https://example.invalid/integration/helix-bpc-157-10mg",
      label: "Integration controlled product fixture",
      targetListingSlug: "helix-bpc-157-10mg",
      rawContent: sourceHtml,
      contentType: "text/html" as const,
      actor: "test:integration",
    };

    const firstRun = await modules.runSourceIngestion(input);
    const repeatedRun = await modules.runSourceIngestion(input);

    expect(firstRun.proposedClaims).toBeGreaterThanOrEqual(5);
    expect(repeatedRun).toEqual(firstRun);

    const pending = (await modules.getPendingClaims()).filter((claim) => claim.runId === firstRun.runId);
    const priceClaim = pending.find((claim) => claim.predicate === "price");
    const confirmationClaim = pending.find((claim) => claim.predicate === "reportConfirmed");

    expect(priceClaim?.proposedValue).toBe(63);
    expect(confirmationClaim?.riskLevel).toBe("high-impact");
    if (!priceClaim || !confirmationClaim) throw new Error("Expected price and report-confirmation claims");

    await expect(
      modules.reviewClaim({
        claimId: confirmationClaim.id,
        decision: "approve",
        actor: "test:reviewer",
        role: "reviewer",
      }),
    ).rejects.toThrow("High-impact changes require an administrator");

    const publication = await modules.reviewClaim({
      claimId: priceClaim.id,
      decision: "approve",
      notes: "Structured offer matches the captured source.",
      actor: "test:admin",
      role: "admin",
    });

    expect(publication).toMatchObject({ status: "published", version: 1 });
    expect((await modules.getProductBySlug("helix-bpc-157-10mg"))?.price).toBe(63);

    const records = await modules.getPublicationRecords();
    expect(records[0]).toMatchObject({
      listingSlug: "helix-bpc-157-10mg",
      version: 1,
      publishedClaimIds: [priceClaim.id],
    });
    expect(records[0].before.price).not.toBe(records[0].after.price);
    expect(records[0].after.price).toBe(63);
  });
});

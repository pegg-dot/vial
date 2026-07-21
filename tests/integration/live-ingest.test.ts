import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.VIAL_PGLITE_MEMORY = "true";

// Minimal HTML mirroring the real schema.org/JSON-LD Product+Offer shape verified live
// on the vendor product pages (e.g. eternalpeptides.com), so the test exercises the same
// extraction path the live fetch hits — without committing a 300KB scraped blob.
function vendorHtml(price: string, availability = "https://schema.org/InStock") {
  return `<!doctype html><html><head>
    <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "BPC-157 5mg",
      offers: { "@type": "Offer", price, priceCurrency: "USD", availability },
    })}</script></head>
    <body><h1>BPC-157 5mg</h1><p>Ships in 2-4 business days. In stock.</p></body></html>`;
}

type Mods = {
  getDatabase: typeof import("@/server/db/client").getDatabase;
  provisionRealBpc157: typeof import("@/server/ingest/bpc157").provisionRealBpc157;
  approveSaneLiveClaims: typeof import("@/server/ingest/bpc157").approveSaneLiveClaims;
  REAL_BPC157_VENDORS: typeof import("@/server/ingest/bpc157").REAL_BPC157_VENDORS;
  registerLiveHttpSource: typeof import("@/server/ingest/live-sources").registerLiveHttpSource;
  LiveIngestNotApprovedError: typeof import("@/server/ingest/live-sources").LiveIngestNotApprovedError;
  runSourceIngestion: typeof import("@/server/agents/pipeline").runSourceIngestion;
  getCatalogSnapshot: typeof import("@/server/catalog/repository").getCatalogSnapshot;
};

describe("live BPC-157 ingest end to end", () => {
  let m: Mods;

  beforeAll(async () => {
    (globalThis as typeof globalThis & { __vialDbPromise?: unknown }).__vialDbPromise = undefined;
    const [client, bpc, live, pipeline, catalog] = await Promise.all([
      import("@/server/db/client"),
      import("@/server/ingest/bpc157"),
      import("@/server/ingest/live-sources"),
      import("@/server/agents/pipeline"),
      import("@/server/catalog/repository"),
    ]);
    m = {
      getDatabase: client.getDatabase,
      provisionRealBpc157: bpc.provisionRealBpc157,
      approveSaneLiveClaims: bpc.approveSaneLiveClaims,
      REAL_BPC157_VENDORS: bpc.REAL_BPC157_VENDORS,
      registerLiveHttpSource: live.registerLiveHttpSource,
      LiveIngestNotApprovedError: live.LiveIngestNotApprovedError,
      runSourceIngestion: pipeline.runSourceIngestion,
      getCatalogSnapshot: catalog.getCatalogSnapshot,
    };
    await m.getDatabase();
  });

  afterAll(async () => {
    const { resetDatabaseForTests } = await import("@/server/db/client");
    await resetDatabaseForTests();
  });

  it("refuses to register a live HTTP source unless explicitly approved", async () => {
    const db = await m.getDatabase();
    await expect(
      m.registerLiveHttpSource(db, {
        key: "unapproved", sourceType: "vendor-page", canonicalLocation: "https://example.com/p",
        label: "x", targetListingSlug: "nope", parserProfile: "jsonld", allowedHostnames: ["example.com"],
      }),
    ).rejects.toBeInstanceOf(m.LiveIngestNotApprovedError);
  });

  it("provisions real vendors + listings marked origin=live, empty until refreshed", async () => {
    const db = await m.getDatabase();
    const provisioned = await m.provisionRealBpc157(db, { approved: true });
    expect(provisioned).toHaveLength(m.REAL_BPC157_VENDORS.length);

    const snapshot = await m.getCatalogSnapshot();
    const liveVendors = snapshot.vendors.filter((v) => v.origin === "live");
    expect(liveVendors.map((v) => v.slug).sort()).toEqual(["biotech-peptides", "bluum-peptides", "eternal-peptides"]);

    const liveListings = snapshot.products.filter((p) => p.origin === "live");
    expect(liveListings).toHaveLength(3);
    for (const l of liveListings) {
      expect(l.price).toBe(0); // nothing seeded — value must arrive via review
      expect(l.externalUrl).toMatch(/^https:\/\//);
      expect(l.checkoutMode).toBe("outbound");
    }
    // The HTTP policy is real (transport http), pointed at the real hostname.
    const policy = await db.query<{ transport: string; allowed_hostnames: unknown }>(
      `SELECT transport, allowed_hostnames FROM source_refresh_policies WHERE id = 'policy:live:eternal-peptides'`,
    );
    expect(policy.rows[0]?.transport).toBe("http");
  });

  it("publishes a real price through snapshot→extract→review onto the live listing", async () => {
    const spec = m.REAL_BPC157_VENDORS[0]; // eternal-peptides
    await m.runSourceIngestion({
      sourceType: "vendor-page",
      canonicalLocation: spec.productUrl,
      label: `${spec.name} test`,
      targetListingSlug: spec.listingSlug,
      rawContent: vendorHtml("34.99"),
      contentType: "text/html",
      parserProfile: "jsonld",
      actor: "test",
      workflow: "test-ingest",
      captureMode: "scheduled",
    });

    const before = (await m.getCatalogSnapshot()).products.find((p) => p.slug === spec.listingSlug);
    expect(before?.price).toBe(0); // still pending, not yet approved

    const result = await m.approveSaneLiveClaims();
    expect(result.approved.some((a) => a.predicate === "price" && a.value === 34.99)).toBe(true);

    const after = (await m.getCatalogSnapshot()).products.find((p) => p.slug === spec.listingSlug);
    expect(after?.price).toBe(34.99);
    expect(after?.availability).toBe("In stock");
    expect(after?.origin).toBe("live"); // origin is preserved through publication
    // Once a real price/availability publishes, the placeholder evidence label must
    // advance — a listing can't show "$35 · checked just now · Awaiting first check".
    expect(after?.evidenceLabel).not.toBe("Awaiting first check");
  });

  it("holds an out-of-range price for a human instead of publishing it", async () => {
    const spec = m.REAL_BPC157_VENDORS[1]; // bluum-peptides
    await m.runSourceIngestion({
      sourceType: "vendor-page",
      canonicalLocation: spec.productUrl,
      label: `${spec.name} test`,
      targetListingSlug: spec.listingSlug,
      rawContent: vendorHtml("9999.00"),
      contentType: "text/html",
      parserProfile: "jsonld",
      actor: "test",
      workflow: "test-ingest",
      captureMode: "scheduled",
    });

    const result = await m.approveSaneLiveClaims();
    expect(result.heldForReview.some((h) => h.predicate === "price")).toBe(true);
    const after = (await m.getCatalogSnapshot()).products.find((p) => p.slug === spec.listingSlug);
    expect(after?.price).toBe(0); // guard held it; nothing published
  });
});

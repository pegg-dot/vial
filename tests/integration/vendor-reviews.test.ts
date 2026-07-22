import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { recordVendorReview, getVendorReview } from "@/server/verify/vendor-reviews";

process.env.VIAL_PGLITE_MEMORY = "true";
process.env.VIAL_SESSION_SECRET = "vendor-reviews-test-secret-at-least-32-characters";
process.env.VIAL_PRIVACY_HASH_SECRET = "vendor-reviews-privacy-secret-at-least-32-characters";

describe("gathered vendor reviews", () => {
  beforeAll(async () => { await resetDatabaseForTests(); await getDatabase(); });
  afterAll(async () => { await resetDatabaseForTests(); });

  it("stores and reads a review with its positives, red flags, and sources", async () => {
    const db = await getDatabase();
    await recordVendorReview(db, {
      vendorSlug: "acme-peptides", sentiment: "mixed",
      summary: "Established but with non-delivery complaints.",
      positives: ["fast shipping", "publishes COAs"],
      redFlags: ["orders never arrived", "support silent"],
      sources: ["r/Peptides", "https://www.trustpilot.com/review/acme.com"],
      reviewVolume: "moderate", confidence: "medium",
    });
    const r = await getVendorReview(db, "acme-peptides");
    expect(r?.sentiment).toBe("mixed");
    expect(r?.positives).toEqual(["fast shipping", "publishes COAs"]);
    expect(r?.redFlags).toContain("support silent");
    expect(r?.sources).toHaveLength(2);
  });

  it("upserts on re-record (one row per vendor)", async () => {
    const db = await getDatabase();
    await recordVendorReview(db, { vendorSlug: "acme-peptides", sentiment: "scam", summary: "Now confirmed scam.", positives: [], redFlags: ["DOJ action"], sources: [], reviewVolume: "heavy", confidence: "high" });
    expect((await getVendorReview(db, "acme-peptides"))?.sentiment).toBe("scam");
    expect((await db.query(`SELECT COUNT(*) n FROM vendor_reviews WHERE vendor_slug='acme-peptides'`)).rows[0].n).toBe(1);
  });

  it("returns null for a vendor with no gathered review", async () => {
    expect(await getVendorReview(await getDatabase(), "nobody")).toBeNull();
  });
});

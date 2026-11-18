import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { getCatalogInsights } from "@/server/admin/catalog-insights";
import { recordPriceObservation } from "@/server/ingest/price-history";
import { recordLabTest } from "@/server/ingest/lab-tests";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SEED_FIXTURES = "false";
process.env.VIALGRADE_SESSION_SECRET = "catalog-insights-test-secret-at-least-32-characters";

// The admin overview's "what the site holds" figures, written through the real writers: the price
// observation the collector records and the lab report the ingest records.
const TODAY = "2026-11-17";
const at = (day: string) => new Date(day + "T15:00:00Z");
const resolve = {
  compounds: [{ slug: "retatrutide", name: "Retatrutide", aliases: [] }, { slug: "bpc-157", name: "BPC-157", aliases: [] }],
  vendors: [{ slug: "acme-peptides", name: "Acme Peptides", domain: "acme-peptides.com" }, { slug: "helix-science", name: "Helix Science", domain: "helix-science.com" }],
};
const price = (listingSlug: string, vendorSlug: string, compoundSlug: string, day: string, source: "live" | "wayback" = "live") =>
  getDatabase().then((db) => recordPriceObservation(db, { listingSlug, vendorSlug, compoundSlug, price: 100, source, observedAt: at(day) }));
const report = (n: number, sampleName: string, manufacturer: string, extra: { vendorSlug?: string | null; lab?: string; isIndependent?: boolean } = {}) =>
  getDatabase().then((db) => recordLabTest(db, { testId: String(n), verifyUrl: "https://verify.example/tests/" + n, sampleName, manufacturer, purityPct: 99.1, ...extra }, resolve as never));

describe("catalogue insights for the admin overview", () => {
  beforeAll(async () => { await resetDatabaseForTests(); await getDatabase(); });
  afterAll(async () => { await resetDatabaseForTests(); });
  beforeEach(async () => {
    const db = await getDatabase();
    await db.query(`DELETE FROM price_observations`);
    await db.query(`DELETE FROM lab_test_records`);
  });

  it("is zeros and nulls with nothing on record, across all 12 weeks", async () => {
    const insights = await getCatalogInsights({ today: TODAY });
    expect(insights).toMatchObject({ vendorsListed: 0, compoundsListed: 0, independentReports: 0, comparableCompounds: 0, lastPriceRead: null, listingsRead7Days: 0, listingsRead30Days: 0, lastReportAdded: null });
    expect(insights.weekly).toHaveLength(12);
    expect(insights.weekly.every((w) => w.listings === 0)).toBe(true);
    expect(insights.weekly.at(-1)!.week).toBe("2026-11-16");
  });

  it("reports when a price was last read and how many listings were read lately, counting a listing once", async () => {
    await price("acme-reta-10", "acme-peptides", "retatrutide", "2026-11-16");
    await price("acme-reta-10", "acme-peptides", "retatrutide", "2026-11-12");
    await price("acme-reta-30", "acme-peptides", "retatrutide", "2026-11-03");
    await price("helix-bpc-5", "helix-science", "bpc-157", "2026-09-20");
    const insights = await getCatalogInsights({ today: TODAY });
    expect(insights).toMatchObject({ lastPriceRead: "2026-11-16", listingsRead7Days: 1, listingsRead30Days: 2, vendorsListed: 2, compoundsListed: 2 });
    const byWeek = Object.fromEntries(insights.weekly.map((w) => [w.week, w.listings]));
    expect(byWeek["2026-11-16"]).toBe(1);
    expect(byWeek["2026-11-09"]).toBe(1);
    expect(byWeek["2026-11-02"]).toBe(1);
    expect(byWeek["2026-09-14"]).toBe(1);
    expect(insights.weekly.reduce((sum, w) => sum + w.listings, 0)).toBe(4);
  });

  it("shows a collection that has stopped as a last-read date in the past and empty recent weeks", async () => {
    await price("acme-reta-10", "acme-peptides", "retatrutide", "2026-10-05");
    await price("helix-bpc-5", "helix-science", "bpc-157", "2026-08-29");
    const insights = await getCatalogInsights({ today: TODAY });
    expect(insights).toMatchObject({ lastPriceRead: "2026-10-05", listingsRead7Days: 0, listingsRead30Days: 0 });
    expect(insights.weekly.slice(-6).every((w) => w.listings === 0)).toBe(true);
    expect(insights.weekly.find((w) => w.week === "2026-10-05")!.listings).toBe(1);
  });

  it("ignores archived price points: only a live read counts as the site reading a price", async () => {
    await price("acme-reta-10", "acme-peptides", "retatrutide", "2026-11-15", "wayback");
    expect(await getCatalogInsights({ today: TODAY })).toMatchObject({ lastPriceRead: null, listingsRead30Days: 0, vendorsListed: 0 });
  });

  it("counts independent reports, and a compound as comparable only when one vendor has both a price and an independent report for it", async () => {
    await price("acme-reta-10", "acme-peptides", "retatrutide", "2026-11-16");
    await price("helix-bpc-5", "helix-science", "bpc-157", "2026-11-16");
    await report(1, "Retatrutide 10mg", "Acme Peptides");                                   // same vendor, same compound: comparable
    await report(2, "Retatrutide 10mg", "Some Factory");                                    // names no vendor on record
    await report(3, "Retatrutide 10mg", "Helix Science");                                   // right compound, vendor lists a different one
    await report(4, "BPC-157 5mg", "Helix Science", { lab: "Vendor self-published", isIndependent: false }); // not independent
    await report(5, "BPC-157 5mg", "Acme Peptides");                                        // independent, but the BPC-157 price is another vendor's
    const insights = await getCatalogInsights({ today: TODAY });
    expect(insights).toMatchObject({ independentReports: 4, vendorsWithReports: 2, comparableCompounds: 1 });
    expect(insights.lastReportAdded).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

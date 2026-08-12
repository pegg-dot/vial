import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { recordPriceObservation, getCompoundPriceSeries, getListingPriceMeta } from "@/server/ingest/price-history";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SESSION_SECRET = "price-history-test-secret-at-least-32-characters";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "price-history-privacy-secret-at-least-32-characters";

describe("price history", () => {
  beforeAll(async () => { await resetDatabaseForTests(); await getDatabase(); });
  afterAll(async () => { await resetDatabaseForTests(); });

  it("records one point per listing per day and keeps the last write for a day", async () => {
    const db = await getDatabase();
    const base = { listingSlug: "v-bpc-157", vendorSlug: "v", compoundSlug: "bpc-157" };
    await recordPriceObservation(db, { ...base, price: 50, source: "wayback", observedAt: new Date("2026-01-10T00:00:00Z") });
    await recordPriceObservation(db, { ...base, price: 55, source: "wayback", observedAt: new Date("2026-03-10T00:00:00Z") });
    await recordPriceObservation(db, { ...base, price: 60, source: "live", observedAt: new Date("2026-07-22T00:00:00Z") });
    // same day, new price → replaces
    await recordPriceObservation(db, { ...base, price: 62, source: "live", observedAt: new Date("2026-07-22T12:00:00Z") });
    const meta = await getListingPriceMeta(db, "v-bpc-157");
    expect(meta.days).toBe(3);
    expect(meta.since).toBe("2026-01-10");
  });

  it("ignores non-positive prices", async () => {
    const db = await getDatabase();
    await recordPriceObservation(db, { listingSlug: "v-junk", vendorSlug: "v", compoundSlug: "x", price: 0, observedAt: new Date("2026-01-01T00:00:00Z") });
    expect((await getListingPriceMeta(db, "v-junk")).days).toBe(0);
  });

  it("rolls up a market-wide median per day for a compound", async () => {
    const db = await getDatabase();
    await recordPriceObservation(db, { listingSlug: "a-tb-500", vendorSlug: "a", compoundSlug: "tb-500", price: 40, observedAt: new Date("2026-06-01T00:00:00Z") });
    await recordPriceObservation(db, { listingSlug: "b-tb-500", vendorSlug: "b", compoundSlug: "tb-500", price: 60, observedAt: new Date("2026-06-01T00:00:00Z") });
    await recordPriceObservation(db, { listingSlug: "c-tb-500", vendorSlug: "c", compoundSlug: "tb-500", price: 50, observedAt: new Date("2026-06-01T00:00:00Z") });
    const series = await getCompoundPriceSeries(db, "tb-500");
    const day = series.find((p) => p.day === "2026-06-01");
    expect(day?.median).toBe(50);
    expect(day?.low).toBe(40);
    expect(day?.high).toBe(60);
    expect(day?.n).toBe(3);
  });
});

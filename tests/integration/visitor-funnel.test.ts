import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabaseForTests, getDatabase } from "@/server/db/client";
import { recordPageView, getVisitorSummary } from "@/server/analytics/visitors";
import { resolveAndRecordClick } from "@/server/outbound/clicks";
import { upsertLiveCompound, upsertLiveListing, upsertLiveVendor } from "@/server/ingest/live-sources";

// A real browser agent. Views without one are treated as automated and excluded from every figure,
// which is exactly what stops crawler hits inflating "buyers sent" — so the fixtures must look like
// the traffic we actually intend to count.
const BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

beforeEach(async () => {
  process.env.VIALGRADE_PGLITE_MEMORY = "true";
  process.env.VIALGRADE_SEED_FIXTURES = "true";
  process.env.VIALGRADE_SEED_DEMO_ACCOUNTS = "true";
  delete (globalThis as { __vialEvidenceSeedPromise?: unknown }).__vialEvidenceSeedPromise;
  delete (globalThis as { __vialSellerOpsSeedPromise?: unknown }).__vialSellerOpsSeedPromise;
  await resetDatabaseForTests();
});

describe("inbound visitor funnel", () => {
  it("counts people, not page views", async () => {
    const db = await getDatabase();
    for (const path of ["/", "/market", "/products/x"]) {
      await recordPageView({ path, ip: "1.1.1.1", userAgent: BROWSER }, db);
    }
    await recordPageView({ path: "/", ip: "2.2.2.2", userAgent: BROWSER }, db);

    const s = await getVisitorSummary({ connection: db });
    expect(s.visits).toBe(4);
    expect(s.readerDays).toBe(2);
  });

  it("attributes a source, and treats our own pages as direct", async () => {
    const db = await getDatabase();
    await recordPageView({ path: "/", referrer: "https://www.reddit.com/r/Peptides/x", ip: "1.1.1.1", userAgent: BROWSER }, db);
    await recordPageView({ path: "/market", referrer: "https://vialgrade.com/", selfHost: "vialgrade.com", ip: "2.2.2.2", userAgent: BROWSER }, db);

    const s = await getVisitorSummary({ connection: db });
    const sources = Object.fromEntries(s.topSources.map(x => [x.source, x.people]));
    expect(sources["reddit.com"]).toBe(1);
    expect(sources["direct"]).toBe(1);
  });

  // Arrivals we can tie to an outbound click. Recorded through the REAL click writer, because a
  // hand-built row can satisfy the join while diverging from what production actually stores.
  it("matches an arrival to a real outbound click on the same day", async () => {
    const db = await getDatabase();
    await upsertLiveCompound(db, {
      slug: "funnel-compound", name: "Funnel Compound", shorthand: "FUN",
      category: "Peptide", description: "test compound", aliases: ["Fun"],
    });
    await upsertLiveVendor(db, {
      slug: "funnel-vendor", name: "Funnel Vendor", domains: ["funnelvendor.example"], description: "test vendor",
    });
    await upsertLiveListing(db, {
      compoundSlug: "funnel-compound", vendorSlug: "funnel-vendor", slug: "funnel-listing",
      name: "Funnel 5mg", quantity: "5mg", externalUrl: "https://funnelvendor.example/p/funnel", price: 49,
    } as Parameters<typeof upsertLiveListing>[1]);

    await recordPageView({ path: "/products/x", ip: "1.1.1.1", userAgent: BROWSER }, db);
    await recordPageView({ path: "/products/y", ip: "3.3.3.3", userAgent: BROWSER }, db);
    // Same ip + agent as the first reader, so the daily hash matches — that is what links them.
    await resolveAndRecordClick("funnel-listing", db, { ip: "1.1.1.1", userAgent: BROWSER });

    const s = await getVisitorSummary({ connection: db });
    expect(s.readerDays).toBe(2);
    expect(s.matchedClickers).toBe(1);
  });

  // The counting unit, stated out loud: a hash rotates daily, so `readerDays` is reader-days, not
  // distinct humans. `busiestDay` is the honest "how many at once" figure.
  it("reports the busiest day rather than implying a distinct-person total", async () => {
    const db = await getDatabase();
    await recordPageView({ path: "/", ip: "1.1.1.1", userAgent: BROWSER }, db);
    await recordPageView({ path: "/market", ip: "2.2.2.2", userAgent: BROWSER }, db);
    await recordPageView({ path: "/market", ip: "2.2.2.2", userAgent: BROWSER }, db);

    const s = await getVisitorSummary({ connection: db });
    expect(s.readerDays).toBe(2);
    expect(s.busiestDay?.people).toBe(2);
    expect(s.busiestDay?.day).toBe(new Date().toISOString().slice(0, 10));
  });

  it("reports nothing rather than dividing by zero on an empty site", async () => {
    const db = await getDatabase();
    const s = await getVisitorSummary({ connection: db });
    expect(s.readerDays).toBe(0);
    expect(s.busiestDay).toBeNull();
  });
});

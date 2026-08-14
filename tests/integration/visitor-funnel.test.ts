import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabaseForTests, getDatabase } from "@/server/db/client";
import { recordPageView, getVisitorSummary } from "@/server/analytics/visitors";

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
    expect(s.people).toBe(2);
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

  // The ratio that sells a deal: arrivals who went on to a vendor.
  it("computes the arrivals-to-buyers rate from a real outbound click", async () => {
    const db = await getDatabase();
    await recordPageView({ path: "/products/x", ip: "1.1.1.1", userAgent: BROWSER }, db);
    await recordPageView({ path: "/products/y", ip: "3.3.3.3", userAgent: BROWSER }, db);

    // The click carries the SAME daily visitor hash, which is what makes the join possible.
    const { visitorHash } = await import("@/server/outbound/attribution");
    await db.query(
      `INSERT INTO outbound_clicks(id, listing_slug, vendor_slug, destination_host, visitor_hash)
       VALUES('click:1','l','v','v.example',$1)`,
      [visitorHash("1.1.1.1", BROWSER)],
    );

    const s = await getVisitorSummary({ connection: db });
    expect(s.people).toBe(2);
    expect(s.clickedOut).toBe(1);
    expect(Math.round(s.clickThroughRate * 100)).toBe(50);
  });

  it("reports a zero rate rather than dividing by zero on an empty site", async () => {
    const db = await getDatabase();
    const s = await getVisitorSummary({ connection: db });
    expect(s.people).toBe(0);
    expect(s.clickThroughRate).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { triageClaim, STOREFRONT_NOISE, PRICE_MIN, PRICE_MAX } from "@/server/refresh/auto-triage";
import { provenanceListingCeiling, PROVENANCE_SWEEP_JOBS } from "@/server/collect/schedule-capacity";
import { PROVENANCE_INTERVAL_MINUTES } from "@/server/ingest/live-sources";

// Every catalogue listing is now enrolled in the provenance pipeline. Before this, the collectors
// created a `sources` row and stopped, so /admin/review, /admin/publications and /admin/traces sat
// permanently empty in production while prices were written straight to the catalogue — the exact
// opposite of what AGENTS.md requires.
//
// Enrolling without triage would be its own failure: hundreds of review items a day is not
// oversight, it is a queue nobody reads.

describe("deciding which claims a person actually has to look at", () => {
  // Measured against live storefronts: bluum, eternal, swiss-chems and loti-labs all emit these
  // four alongside a good price, scraped out of page navigation. Real observed values include
  // batchCode "SYNTHESIS" and reportIssuer "...Search Login Cart".
  it("auto-rejects evidence predicates scraped from a storefront", () => {
    for (const predicate of STOREFRONT_NOISE) {
      expect(triageClaim(predicate, "SYNTHESIS").action).toBe("reject");
    }
  });

  it("auto-approves routine commerce values", () => {
    expect(triageClaim("price", 89).action).toBe("approve");
    expect(triageClaim("availability", "In stock").action).toBe("approve");
    expect(triageClaim("shipping", "Free over $100").action).toBe("approve");
  });

  // A price outside the band is the interesting case — a $4 vial or a $9,000 one is either a parse
  // error or something worth knowing about. Neither should publish itself.
  it("holds a price outside the band for a person", () => {
    expect(triageClaim("price", PRICE_MIN - 1).action).toBe("hold");
    expect(triageClaim("price", PRICE_MAX + 1).action).toBe("hold");
    expect(triageClaim("price", "89").action).toBe("hold");
    expect(triageClaim("price", Number.NaN).action).toBe("hold");
  });

  // The default must be hold. A predicate nobody has thought about must not be able to publish
  // itself simply because no rule mentions it.
  it("holds anything with no policy rather than approving it", () => {
    expect(triageClaim("purityPct", 99.1).action).toBe("hold");
    expect(triageClaim("somethingNew", true).action).toBe("hold");
  });

  it("gives a reason a person can act on", () => {
    expect(triageClaim("price", 9000).reason).toContain("outside");
    expect(triageClaim("batchCode", "SYNTHESIS").reason).toContain("storefront");
  });
});

describe("the provenance schedule can serve everything enrolled", () => {
  const PROVENANCE_CRON = "*/15 * * * *";

  it("matches the cron actually configured", () => {
    const cfg = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")) as { crons: { path: string; schedule: string }[] };
    expect(cfg.crons.find((c) => c.path.endsWith("/provenance"))?.schedule).toBe(PROVENANCE_CRON);
  });

  // Sized against the real catalogue. The public sitemap carries 897 product pages and
  // woocommerce-import records 537 live listings; an earlier reading of "43 listings" off /market
  // was a facet count. Sizing to 43 would have rebuilt the collector starvation on purpose.
  const REAL_CATALOGUE = 897;

  it("serves the whole catalogue with headroom", () => {
    const ceiling = provenanceListingCeiling(PROVENANCE_CRON, PROVENANCE_INTERVAL_MINUTES);
    expect(ceiling).toBe(1920);
    expect(ceiling).toBeGreaterThan(REAL_CATALOGUE * 1.5);
  });

  // Both arrangements this replaced. The daily sweep could not serve even a fiftieth of it, and the
  // hourly one I sized off the wrong number could not serve it either.
  it("rejects the daily and hourly schedules this replaced", () => {
    expect(provenanceListingCeiling("30 5 * * *", PROVENANCE_INTERVAL_MINUTES)).toBeLessThan(REAL_CATALOGUE);
    expect(provenanceListingCeiling("15 * * * *", PROVENANCE_INTERVAL_MINUTES)).toBeLessThan(REAL_CATALOGUE);
  });

  // A sweep is sequential and every job is a network fetch, so it must stop on time rather than be
  // killed mid-flight leaving a job claimed and unfinished. Frequency is what scales this, not size.
  it("bounds a sweep by time, not only by count", () => {
    const scheduler = readFileSync(new URL("../../src/server/refresh/scheduler.ts", import.meta.url), "utf8");
    expect(scheduler).toContain("budgetMs");
    expect(scheduler).toMatch(/if \(Date\.now\(\) >= deadline\) break;/);
  });

  it("keeps the sweep size the route uses and the one it scores identical", () => {
    const route = readFileSync(new URL("../../src/app/api/internal/cron/provenance/route.ts", import.meta.url), "utf8");
    expect(route).toContain("runRefreshSweep(PROVENANCE_SWEEP_JOBS)");
    expect(PROVENANCE_SWEEP_JOBS).toBeGreaterThan(0);
  });

  // Housekeeping must NOT have followed the sweep onto an hourly schedule.
  it("leaves retention and the intelligence sweep on the daily cron", () => {
    const daily = readFileSync(new URL("../../src/app/api/internal/cron/refresh/route.ts", import.meta.url), "utf8");
    expect(daily).toContain("runIntelligenceSweep");
    expect(daily).toContain("applyRetention");
    expect(daily).not.toContain("runRefreshSweep");
  });
});

describe("enrolment", () => {
  it("takes a provenance snapshot daily, leaving price freshness to the hourly collectors", () => {
    expect(PROVENANCE_INTERVAL_MINUTES).toBe(1440);
  });

  // The allowlist must be the listing's own vendor host and nothing wider — same trust boundary as
  // the collector that produced the row, never a broadened one.
  it("allowlists only the listing's own hostname", () => {
    const src = readFileSync(new URL("../../src/server/ingest/live-sources.ts", import.meta.url), "utf8");
    expect(src).toContain("new URL(input.canonicalLocation).hostname.toLowerCase()");
    expect(src).toContain("JSON.stringify([hostname])");
  });

  it("is actually wired into the catalogue writer, not merely defined", () => {
    const src = readFileSync(new URL("../../src/server/ingest/live-sources.ts", import.meta.url), "utf8");
    const recordAt = src.indexOf("export async function recordCatalogListing(");
    expect(recordAt).toBeGreaterThan(-1);
    expect(src.slice(recordAt)).toContain("await enrolListingForRefresh(db,");
  });
});

// Phase 0 of docs/superpowers/specs/2026-08-29-vial-price-truth-design.md (D1, D2). A scraped page
// is a lossy view of the vendor's own structured catalogue feed, which the hourly collector reads
// directly. While that feed is fresh, a page-scrape price claim can only add noise — or a promo
// banner. When the feed is stale or failing, the scrape is the fallback and is judged on its merits.
describe("a scraped price cannot overrule a fresh catalogue feed", () => {
  const HOUR = 3_600_000;
  const now = new Date("2026-08-29T18:00:00Z");
  const ago = (hours: number) => new Date(now.getTime() - hours * HOUR);

  it("rejects a scraped price while the vendor's catalogue feed is fresh, and says why", () => {
    // Fails if triage ignores the feed — the umbrella-labs "$100" banner would be approved again.
    const decision = triageClaim("price", 100, { riskLevel: "standard", feedReadAt: ago(1), now });
    expect(decision.action).toBe("reject");
    expect(decision.reason).toMatch(/catalogue feed/i);
    expect(decision.reason).toContain(ago(1).toISOString());
  });

  it("rejects even an in-band, routine scraped price while the feed is fresh", () => {
    // Fails if supersession is only applied to suspicious values.
    expect(triageClaim("price", 89, { riskLevel: "standard", feedReadAt: ago(6), now }).action).toBe("reject");
  });

  it("holds a material scraped price move for a person when the feed is stale", () => {
    // Fails if risk_level stays decorative (today any price in [10,500] is approved).
    const decision = triageClaim("price", 150, { riskLevel: "material", feedReadAt: ago(72), now });
    expect(decision.action).toBe("hold");
    expect(decision.reason).toMatch(/material/i);
  });

  it("approves a routine scraped price when the feed is stale (control)", () => {
    expect(triageClaim("price", 40, { riskLevel: "standard", feedReadAt: ago(72), now }).action).toBe("approve");
  });

  it("approves a routine scraped price for a listing with no catalogue feed at all (control)", () => {
    expect(triageClaim("price", 40, { riskLevel: "standard", feedReadAt: null, now }).action).toBe("approve");
  });

  it("treats a feed read more than 48 hours ago as stale", () => {
    // Fails if the freshness window drifts from FEED_FRESH_HOURS.
    expect(triageClaim("price", 40, { riskLevel: "standard", feedReadAt: ago(47), now }).action).toBe("reject");
    expect(triageClaim("price", 40, { riskLevel: "standard", feedReadAt: ago(49), now }).action).toBe("approve");
  });

  it("still holds a value that is not a price, whatever the feed says", () => {
    expect(triageClaim("price", "100", { riskLevel: "standard", feedReadAt: ago(1), now }).action).toBe("hold");
  });

  it("leaves availability and shipping untouched by the price rule (control)", () => {
    expect(triageClaim("availability", "In stock", { riskLevel: "standard", feedReadAt: ago(1), now }).action).toBe("approve");
  });
});

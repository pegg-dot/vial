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
  const PROVENANCE_CRON = "15 * * * *";

  it("matches the cron actually configured", () => {
    const cfg = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")) as { crons: { path: string; schedule: string }[] };
    expect(cfg.crons.find((c) => c.path.endsWith("/provenance"))?.schedule).toBe(PROVENANCE_CRON);
  });

  // Production had 43 listings when this was built and grows as the collector backlog drains. The
  // ceiling has to leave room for that, not just clear today's number.
  it("serves far more listings than production has", () => {
    const ceiling = provenanceListingCeiling(PROVENANCE_CRON, PROVENANCE_INTERVAL_MINUTES);
    expect(ceiling).toBe(480);
    expect(ceiling).toBeGreaterThan(43 * 5);
  });

  // The old arrangement — one sweep a day — could not serve even the 43 that existed. Enrolling
  // everything onto that schedule would have rebuilt the starvation deliberately.
  it("rejects the daily sweep this replaced", () => {
    expect(provenanceListingCeiling("30 5 * * *", PROVENANCE_INTERVAL_MINUTES)).toBeLessThan(43);
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

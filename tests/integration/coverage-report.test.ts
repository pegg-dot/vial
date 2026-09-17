// The public "what we hold" figures.
//
// The whole value of this page is that a reader can check it, so the two things worth pinning are
// that the numbers come from the database rather than from copy, and that the GAPS are derived
// from the same counts as the totals. A hand-written "we cover almost everything" is true until
// the day it is not, and nothing tells you which day that was.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests, type SqlConnection } from "@/server/db/client";
import { getCoverageReport, coverageGaps } from "@/server/analytics/coverage-report";
import { readFileSync } from "node:fs";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SESSION_SECRET = "coverage-report-secret-at-least-32-characters!!!";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "coverage-report-privacy-at-least-32-characters!!";

let db: SqlConnection;
beforeAll(async () => { await resetDatabaseForTests(); db = await getDatabase(); });
afterAll(async () => { await resetDatabaseForTests(); });

describe("the coverage figures come from the database", () => {
  it("counts what is actually on record", async () => {
    const before = await getCoverageReport(db);
    await db.query(
      `INSERT INTO compounds (id, slug, canonical_name, shorthand, category, description)
       VALUES ('cmp-cov','coverage-probe','Coverage Probe','CVP','Research chemical','t')`,
    );
    const after = await getCoverageReport(db);
    expect(after.compounds).toBe(before.compounds + 1);
  });

  it("separates shops from upstream makers, which are not the same claim", async () => {
    // Seeded explicitly: asserting a partition against an empty table is 0 + 0 === 0, which passes
    // however broken the split is.
    for (const [id, kind] of [["org-shop-1", "storefront"], ["org-shop-2", "storefront"], ["org-maker-1", "manufacturer"]]) {
      await db.query(
        `INSERT INTO organizations (id, slug, organization_type, display_name, vendor_kind)
         VALUES ($1, $1, 'vendor', $1, $2) ON CONFLICT (id) DO UPDATE SET vendor_kind = EXCLUDED.vendor_kind`,
        [id, kind],
      );
    }
    const r = await getCoverageReport(db);
    expect(r.vendors).toBeGreaterThanOrEqual(3);
    expect(r.storefronts).toBeGreaterThanOrEqual(2);
    expect(r.makers).toBeGreaterThanOrEqual(1);
    // Every vendor is exactly one of the two, so the parts must sum to the whole.
    expect(r.storefronts + r.makers).toBe(r.vendors);
  });

  it("never reports more graded storefronts than storefronts", async () => {
    const r = await getCoverageReport(db);
    expect(r.gradedStorefronts).toBeLessThanOrEqual(r.storefronts);
    expect(r.gradedVendors).toBeLessThanOrEqual(r.vendors);
    expect(r.listingsWithPrice).toBeLessThanOrEqual(r.listings);
    expect(r.compoundsWithTestedPurity).toBeLessThanOrEqual(r.compounds);
  });
});

describe("the gaps are derived, not written down", () => {
  it("reports a gap that matches the counts it came from", () => {
    const gaps = coverageGaps({
      compounds: 60, compoundsWithTestedPurity: 32,
      vendors: 124, storefronts: 27, makers: 97, gradedVendors: 25, gradedStorefronts: 25,
      listings: 1190, listingsWithPrice: 1190,
      independentCertificates: 317, labs: 3, enforcementRecords: 40, vendorsNamedInEnforcement: 30,
      lastReadAt: null,
    });
    const purity = gaps.find(g => g.weDoNotHold.includes("purity"))!;
    expect(purity.count).toBe(28);
    expect(purity.outOf).toBe(60);
    const graded = gaps.find(g => g.weDoNotHold.includes("grade"))!;
    expect(graded.count).toBe(2);
  });

  // "0 of 60 missing" is not a gap, and printing it trains the reader to skim the list.
  it("omits a measure with nothing missing", () => {
    const gaps = coverageGaps({
      compounds: 10, compoundsWithTestedPurity: 10,
      vendors: 5, storefronts: 5, makers: 0, gradedVendors: 5, gradedStorefronts: 5,
      listings: 20, listingsWithPrice: 20,
      independentCertificates: 9, labs: 1, enforcementRecords: 0, vendorsNamedInEnforcement: 0,
      lastReadAt: null,
    });
    expect(gaps).toHaveLength(0);
  });

  // The doctrine absence.ts exists to enforce: a hole in our capture is a fact about US.
  it("phrases every gap as our limit, never as a property of a vendor or compound", () => {
    const gaps = coverageGaps({
      compounds: 60, compoundsWithTestedPurity: 1,
      vendors: 100, storefronts: 50, makers: 50, gradedVendors: 1, gradedStorefronts: 1,
      listings: 500, listingsWithPrice: 10,
      independentCertificates: 5, labs: 1, enforcementRecords: 0, vendorsNamedInEnforcement: 0,
      lastReadAt: null,
    });
    expect(gaps.length).toBeGreaterThan(0);
    for (const g of gaps) {
      expect(g.weDoNotHold, "a gap must read as something WE do not hold").not.toMatch(/untested|unverified|impure|fake|bad|unsafe/i);
      expect(g.why).toBeTruthy();
    }
  });
});

describe("the page does not make the one claim it cannot support", () => {
  const page = readFileSync(new URL("../../src/app/coverage/page.tsx", import.meta.url), "utf8");

  // Every directory in this market calls itself impartial, so the word carries no information — and
  // a page that announces its own lack of bias is doing what a biased one would also do. The page
  // publishes the arithmetic instead, including the gaps, and says nothing about its own virtue.
  it("never calls itself unbiased, impartial, most complete or the best", () => {
    expect(page).not.toMatch(/\b(unbiased|impartial|most (complete|trusted|unbiased)|the best|number one|industry.leading)\b/i);
  });

  it("never turns a gap into a safety or quality verdict", () => {
    expect(page).not.toMatch(/\b(safe|approved|guaranteed|pure enough|scam-free)\b/i);
  });

  it("renders the gaps section at all", () => {
    expect(page).toContain("What we don");
    expect(page).toContain("coverageGaps");
  });
});

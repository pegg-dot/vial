import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  COMPOUND_LITE_FIELDS,
  PRODUCT_LITE_FIELDS,
  VENDOR_LITE_FIELDS,
  VENDOR_LITE_GRADE_FIELDS,
  emptyCatalogLite,
  toCatalogLite,
} from "@/lib/catalog-lite";
import type { CatalogSnapshot, Compound, Product, Vendor } from "@/lib/types";

// A record with EVERY field the full types carry, so the projection is tested against the real
// shape rather than against a fixture that happens to be narrow already. If a field is added to
// Compound/Vendor/Product and not to the lite projection, this fixture still carries it and the
// key-set assertions below still pass — which is correct: new fields must be opted IN, never
// inherited into the payload every page pays for.
const compound: Compound = {
  slug: "bpc-157", name: "BPC-157", shorthand: "BPC", category: "repair", description: "A long compound description that no page chrome renders.",
  aliases: ["body protection compound"], listings: 12, medianPrice: 48, medianPricePerMg: 4.8, priceChange: -3,
  documentationCoverage: 62, coaCount: 7, medianPurity: 98.4, accent: ["#12b3a6", "#8fffd6", "#ffffff"],
  researchNote: "A long research note that no page chrome renders either.", origin: "live",
};
const vendor: Vendor = {
  slug: "northstar", name: "Northstar Research", initials: "NR", description: "A long vendor description.",
  location: "Nevada", founded: "2019", profileStatus: "claimed", productCount: 31, documentationCurrent: 44,
  medianShipDays: 3, supportScore: 4.2, lastObserved: "2 days ago", accent: ["#2b31d8", "#8fa2ff"],
  history: [{ date: "2026-07-01", event: "Catalog re-read", type: "catalog" }], origin: "live", kind: "storefront",
  grade: { letter: "B", band: "solid", headline: "Headline nobody renders on a card", rationale: "Why this vendor got this letter.", summary: "A longer summary.", weighed: 9, verifiedCount: 4, gradedAt: "2026-08-01T00:00:00.000Z" },
  coaCount: 7, medianPurity: 98.1, passportCount: 2, reviewCount: 18, latestTestedAt: "2026-07-20T00:00:00.000Z",
};
const product: Product = {
  slug: "northstar-bpc-157-5mg", name: "BPC-157", compoundSlug: "bpc-157", vendorSlug: "northstar", quantity: "5mg",
  mg: 5, pricePerMg: 9.8, form: "lyophilized", price: 49, previousPrice: 54, currency: "USD", availability: "In stock",
  shipping: "Ships in 2 days", evidenceLevel: "independent", evidenceLabel: "Independent lab", reportDate: "2026-06-02",
  reportIssuer: "Janoshik", reportConfirmed: true, advertisesTesting: true, observedAt: "2026-08-01T00:00:00.000Z",
  batchCode: "NS-BPC-2607", batchLinked: true, sampleOrigin: "vendor-submitted", lastChecked: "2 days ago",
  rating: 4.6, reviewCount: 22, featured: true, checkoutMode: "outbound",
  priceHistory: [61, 59, 60, 58, 58, 57, 54, 54], accent: ["#12b3a6", "#8fffd6", "#ffffff"],
  evidence: [{ label: "Identity", status: "established", detail: "A long evidence detail string." }],
  origin: "live", externalUrl: "https://example.test/p", imageUrl: "https://example.test/p.jpg",
  trust: { status: "batch-verified", tone: "good", label: "Batch verified", detail: "A long trust detail string.", priceFlag: null, priceNote: null, compoundCoas: 7, compoundMedianPurity: 98.4, vendorFlagged: false, adjustedPricePerMg: 10.0, purityBasis: "vendor" },
};
const snapshot: CatalogSnapshot = { compounds: [compound], vendors: [vendor], products: [product], generatedAt: "2026-08-18T00:00:00.000Z" };

describe("catalog lite projection", () => {
  // These four assertions are the guard. The root layout ships this projection into the HTML of
  // every page on the site, so re-widening it costs every page view and every crawler hit. A field
  // may only enter the payload by being added to the pinned list here, deliberately, in the diff.
  it("emits exactly the pinned compound fields", () => {
    expect(Object.keys(toCatalogLite(snapshot).compounds[0]).sort()).toEqual([...COMPOUND_LITE_FIELDS].sort());
  });
  it("emits exactly the pinned vendor fields", () => {
    expect(Object.keys(toCatalogLite(snapshot).vendors[0]).sort()).toEqual([...VENDOR_LITE_FIELDS].sort());
  });
  it("emits exactly the pinned product fields", () => {
    expect(Object.keys(toCatalogLite(snapshot).products[0]).sort()).toEqual([...PRODUCT_LITE_FIELDS].sort());
  });
  it("emits exactly the pinned vendor-grade fields", () => {
    expect(Object.keys(toCatalogLite(snapshot).vendors[0].grade!).sort()).toEqual([...VENDOR_LITE_GRADE_FIELDS].sort());
  });

  it("drops the heavy per-record collections entirely", () => {
    const serialized = JSON.stringify(toCatalogLite(snapshot));
    // Matched as JSON keys, not bare substrings — `evidenceLabel` is kept and contains "evidence".
    for (const field of ["priceHistory", "evidence", "researchNote", "description", "history", "summary", "headline", "reportIssuer", "batchCode", "trust", "medianPurity", "reviewCount", "priceChange"]) {
      expect(serialized).not.toContain(`"${field}":`);
    }
  });

  it("ships only the first accent colour, the only one any global surface reads", () => {
    const lite = toCatalogLite(snapshot);
    expect(lite.products[0].accent).toEqual(["#12b3a6"]);
    expect(lite.vendors[0].accent).toEqual(["#2b31d8"]);
    expect(lite.compounds[0].accent).toEqual(["#12b3a6"]);
  });

  it("keeps every value the site chrome renders, unchanged", () => {
    const lite = toCatalogLite(snapshot);
    // The search overlay's listing row: title, vendor lookup key, price and evidence label.
    expect(lite.products[0]).toMatchObject({ slug: "northstar-bpc-157-5mg", name: "BPC-157", quantity: "5mg", vendorSlug: "northstar", price: 49, evidenceLabel: "Independent lab", featured: true, origin: "live" });
    // The search overlay's compound and vendor rows.
    expect(lite.compounds[0]).toMatchObject({ shorthand: "BPC", aliases: ["body protection compound"], listings: 12, coaCount: 7 });
    expect(lite.vendors[0]).toMatchObject({ name: "Northstar Research", initials: "NR", productCount: 31, coaCount: 7 });
    // The market card's grade pill and its "% vs median/mg" line.
    expect(lite.vendors[0].grade).toEqual({ letter: "B", band: "solid", rationale: "Why this vendor got this letter." });
    expect(lite.compounds[0].medianPricePerMg).toBe(4.8);
  });

  it("carries a never-graded vendor across as null rather than inventing a letter", () => {
    const ungraded = toCatalogLite({ ...snapshot, vendors: [{ ...vendor, grade: null }] });
    expect(ungraded.vendors[0].grade).toBeNull();
  });

  it("degrades to an empty catalog rather than to fabricated records", () => {
    const empty = emptyCatalogLite("2026-08-18T00:00:00.000Z");
    expect(empty).toEqual({ compounds: [], vendors: [], products: [], generatedAt: "2026-08-18T00:00:00.000Z" });
  });

  // The projection is only worth anything if the layout actually uses it. Without this, a future
  // edit could hand MarketplaceProvider the full snapshot again and every test above would still
  // pass while every page went back over a megabyte.
  it("is what the root layout hands the marketplace provider", () => {
    const layout = readFileSync(path.join(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(layout).toContain("toCatalogLite");
    expect(layout).toMatch(/getCatalogSnapshot\(\)\s*\.then\(toCatalogLite\)/);
    // The provider must receive the projected value, never a raw snapshot bound to another name.
    expect(layout).toMatch(/<MarketplaceProvider catalog=\{catalog\}/);
  });

  // Every client surface that reads whole records must take them as a prop from its own server
  // component. Reaching back into useMarketplace() would silently re-require the full payload in
  // the layout, which is how this regression would return.
  it("keeps the full-record surfaces off the shared provider", () => {
    for (const file of ["src/components/market/market-experience.tsx", "src/components/market/market-browser.tsx", "src/components/market/compounds-experience.tsx"]) {
      expect(readFileSync(path.join(process.cwd(), file), "utf8")).not.toMatch(/const \{[^}]*catalog[^}]*\} = useMarketplace\(\)/);
    }
  });
});

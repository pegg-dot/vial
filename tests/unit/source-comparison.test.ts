import { describe, expect, it } from "vitest";
import {
  buildSourceComparison, comparisonSort, formatPurityRange, pickSources, reportDay, reportedSource, sortSources,
  type ComparisonTest,
} from "@/lib/source-comparison";
import type { Product } from "@/lib/types";

// The vendor comparison joins two populations that barely overlap: vendors whose listings were
// read, and sources a lab report names. Every listing and every report must land in exactly one
// row (or be counted as naming no source), and a gap must stay a gap.
const listing = (over: Partial<Product>): Product => ({
  slug: "acme-reta-10", name: "Retatrutide 10mg", compoundSlug: "retatrutide", vendorSlug: "acme-peptides", quantity: "10mg", mg: 10, pricePerMg: 12,
  price: 120, availability: "In stock", observedAt: "2026-11-02T10:00:00.000Z", ...over,
} as Product);

const report = (over: Partial<ComparisonTest>): ComparisonTest => ({
  lab: "Janoshik Analytical", verify_url: "https://verify.example/1", sample_name: "Retatrutide 10mg", manufacturer: "Acme Peptides",
  vendor_slug: null, batch_code: null, purity_pct: "99.1", measured_content: "10.4 mg", tested_at: "2026-09-10", test_type: "purity",
  is_blind: false, is_independent: true, ...over,
});

const NAMES = new Map([["acme-peptides", "Acme Peptides"], ["helix-science", "Helix Science"], ["quiet-labs", "Quiet Labs"]]);

const LISTINGS = [
  listing({}),
  listing({ slug: "acme-reta-30", name: "Retatrutide 30mg", mg: 30, pricePerMg: 9, price: 270, observedAt: "2026-11-04T10:00:00.000Z" }),
  listing({ slug: "helix-reta-10", vendorSlug: "helix-science", pricePerMg: 15, price: 150, observedAt: "2026-10-01T10:00:00.000Z" }),
  listing({ slug: "helix-reta-kit", vendorSlug: "helix-science", name: "Retatrutide kit", quantity: "1 kit", mg: undefined, pricePerMg: undefined, price: 400, observedAt: "2026-10-20T10:00:00.000Z" }),
];

const REPORTS = [
  report({ vendor_slug: "acme-peptides", verify_url: "https://verify.example/a1", purity_pct: "99.1", tested_at: "2026-09-10" }),
  report({ vendor_slug: "acme-peptides", verify_url: "https://verify.example/a2", purity_pct: 98.3, measured_content: "7.1 mg", tested_at: "2026-10-12", is_blind: true }),
  report({ vendor_slug: "acme-peptides", verify_url: "https://verify.example/a3", purity_pct: "99.9", lab: "Vendor self-published", is_independent: false, tested_at: "2026-11-01" }),
  report({ manufacturer: "https://www.MJTpeptides.com/", verify_url: "https://verify.example/m1", purity_pct: "99.94", measured_content: "33.89 mg", sample_name: "Retatrutide 30mg" }),
  report({ manufacturer: "www.mjtpeptides.com", verify_url: "https://verify.example/m2", purity_pct: "99.5", sample_name: "Retatrutide 30mg", measured_content: null }),
  report({ manufacturer: "Aura", verify_url: "https://verify.example/au", purity_pct: null }),
  report({ manufacturer: "Unknown", verify_url: "https://verify.example/u1" }),
  report({ manufacturer: "", verify_url: "https://verify.example/u2" }),
];

describe("buildSourceComparison", () => {
  const { sources, unattributedReports } = buildSourceComparison(LISTINGS, REPORTS, NAMES);
  const by = (key: string) => sources.find((s) => s.key === key)!;

  it("gives every source one row, whether it has listings, reports or both", () => {
    expect(sources.map((s) => s.key).sort()).toEqual(["_aura", "_mjtpeptides-com", "acme-peptides", "helix-science"]);
  });

  it("accounts for every listing and every report exactly once", () => {
    expect(sources.flatMap((s) => s.listings.map((p) => p.slug)).sort()).toEqual(LISTINGS.map((p) => p.slug).sort());
    const filed = sources.flatMap((s) => s.tests.map((t) => t.verify_url));
    expect(new Set(filed).size).toBe(filed.length);
    expect(filed.length + unattributedReports).toBe(REPORTS.length);
    expect(unattributedReports).toBe(2);
  });

  it("reads a vendor's price off its own listings: lowest per mg, the sizes, the last day read", () => {
    const acme = by("acme-peptides");
    expect(acme).toMatchObject({ vendorSlug: "acme-peptides", name: "Acme Peptides", lowestPerMg: 9, sizesMg: [10, 30], lastRead: "2026-11-04" });
    expect(acme.lowestPerMgListing?.slug).toBe("acme-reta-30");
    expect(acme.listings.map((p) => p.slug)).toEqual(["acme-reta-30", "acme-reta-10"]);
  });

  it("keeps a listing with no readable strength in the row, after the ones that can be priced per mg", () => {
    const helix = by("helix-science");
    expect(helix.listings.map((p) => p.slug)).toEqual(["helix-reta-10", "helix-reta-kit"]);
    expect(helix.lowestPerMg).toBe(15);
    expect(helix.lastRead).toBe("2026-10-20");
  });

  it("counts only independent reports toward purity, content and the report count", () => {
    const acme = by("acme-peptides");
    expect(acme).toMatchObject({ independentReports: 2, blindReports: 1, otherReports: 1, purityCount: 2, purityMin: 98.3, purityMax: 99.1, lastReported: "2026-10-12" });
    expect(acme.purityMedian).toBeCloseTo(98.7, 5);
    // The self-published 99.9% is in the row for the reader, and in no figure.
    expect(acme.tests.map((t) => t.verify_url)).toEqual(["https://verify.example/a2", "https://verify.example/a1", "https://verify.example/a3"]);
  });

  it("sets measured content against the label and counts the short ones", () => {
    expect(by("acme-peptides")).toMatchObject({ contentChecked: 2, contentShort: 1 });
    expect(by("_mjtpeptides-com")).toMatchObject({ contentChecked: 1, contentShort: 0 });
  });

  it("files a report that names no vendor on record under the name it prints, as one source, with no vendor link", () => {
    const mjt = by("_mjtpeptides-com");
    expect(mjt).toMatchObject({ vendorSlug: null, name: "mjtpeptides.com", independentReports: 2, purityMin: 99.5, purityMax: 99.94 });
    expect(mjt.listings).toEqual([]);
    expect(mjt.lowestPerMg).toBeNull();
    expect(mjt.lastRead).toBeNull();
  });

  it("shows a gap as a gap: a listed vendor with no report, a reported source with no figure", () => {
    expect(by("helix-science")).toMatchObject({ independentReports: 0, purityCount: 0, purityMin: null, purityMedian: null, contentChecked: 0, lastReported: null });
    expect(by("_aura")).toMatchObject({ independentReports: 1, purityCount: 0, purityMedian: null });
    expect(formatPurityRange(by("_aura"))).toBeNull();
  });

  it("links a report to a vendor only when that vendor has a record or a listing here", () => {
    const stray = [report({ vendor_slug: "ghost-vendor", manufacturer: "Ghost Labs", verify_url: "https://verify.example/g" })];
    const ghost = buildSourceComparison([], stray, NAMES).sources[0];
    expect(ghost).toMatchObject({ key: "_ghost-labs", vendorSlug: null, name: "Ghost Labs" });
    // A vendor with a record but no listing for this compound still gets its own linked row.
    const quiet = buildSourceComparison([], [report({ vendor_slug: "quiet-labs", verify_url: "https://verify.example/q" })], NAMES).sources[0];
    expect(quiet).toMatchObject({ key: "quiet-labs", vendorSlug: "quiet-labs", name: "Quiet Labs" });
    // A listing vendor missing from the directory keeps its row, named from its slug.
    const unnamed = buildSourceComparison([listing({ vendorSlug: "new-vendor" })], [report({ vendor_slug: "new-vendor", verify_url: "https://verify.example/n" })], new Map()).sources;
    expect(unnamed).toHaveLength(1);
    expect(unnamed[0]).toMatchObject({ key: "new-vendor", vendorSlug: "new-vendor", name: "New Vendor", independentReports: 1 });
  });

  it("sets a flagged outlier price aside when the source has any other, and says how many", () => {
    const flagged = listing({ slug: "acme-blend", pricePerMg: 0.01, price: 2, trust: { priceFlag: "too-cheap" } as Product["trust"] });
    const withOutlier = buildSourceComparison([flagged, ...LISTINGS], [], NAMES).sources.find((s) => s.key === "acme-peptides")!;
    expect(withOutlier).toMatchObject({ lowestPerMg: 9, outlierListings: 1 });
    expect(withOutlier.listings).toHaveLength(3);
    // With nothing else to go on, the flagged price is what is on record, still flagged.
    const only = buildSourceComparison([flagged], [], NAMES).sources[0];
    expect(only).toMatchObject({ lowestPerMg: 0.01, outlierListings: 1 });
  });

  it("is empty for a compound with nothing on record", () => {
    expect(buildSourceComparison([], [], NAMES)).toEqual({ sources: [], unattributedReports: 0 });
  });
});

describe("sortSources", () => {
  const { sources } = buildSourceComparison(LISTINGS, REPORTS, NAMES);
  const order = (sort: Parameters<typeof sortSources>[1]) => sortSources(sources, sort).map((s) => s.key);

  it("defaults to the most complete record: both, then listed only, then reported only", () => {
    expect(sources.map((s) => s.key)).toEqual(["acme-peptides", "helix-science", "_mjtpeptides-com", "_aura"]);
    expect(order("coverage")).toEqual(sources.map((s) => s.key));
  });

  it("puts a source missing the figure last, never first and never dropped", () => {
    expect(order("price")).toEqual(["acme-peptides", "helix-science", "_aura", "_mjtpeptides-com"]);
    expect(order("purity")).toEqual(["_mjtpeptides-com", "acme-peptides", "_aura", "helix-science"]);
    expect(order("read")).toEqual(["acme-peptides", "helix-science", "_aura", "_mjtpeptides-com"]);
    for (const sort of ["coverage", "price", "purity", "reports", "read"] as const) expect(order(sort).sort()).toEqual(sources.map((s) => s.key).sort());
  });

  it("orders by the number of independent reports, then blind ones", () => {
    expect(order("reports")).toEqual(["acme-peptides", "_mjtpeptides-com", "_aura", "helix-science"]);
  });

  it("reads the sort from the query, falling back to the default for anything else", () => {
    expect(comparisonSort("purity")).toBe("purity");
    expect(comparisonSort(["price", "purity"])).toBe("price");
    for (const junk of [undefined, "", "cheapest", "PRICE", "__proto__", "constructor"]) expect(comparisonSort(junk)).toBe("coverage");
  });
});

describe("pickSources", () => {
  const { sources } = buildSourceComparison(LISTINGS, REPORTS, NAMES);

  it("returns the chosen rows in the order chosen", () => {
    expect(pickSources(sources, "_mjtpeptides-com", "acme-peptides").map((s) => s.key)).toEqual(["_mjtpeptides-com", "acme-peptides"]);
    expect(pickSources(sources, undefined, "helix-science").map((s) => s.key)).toEqual(["helix-science"]);
  });

  it("drops unknown keys and a source chosen twice", () => {
    expect(pickSources(sources, "nope", "acme-peptides").map((s) => s.key)).toEqual(["acme-peptides"]);
    expect(pickSources(sources, "acme-peptides", "acme-peptides").map((s) => s.key)).toEqual(["acme-peptides"]);
    expect(pickSources(sources, ["helix-science", "acme-peptides"], undefined).map((s) => s.key)).toEqual(["helix-science"]);
    expect(pickSources(sources, undefined, undefined)).toEqual([]);
  });
});

describe("reportedSource and reportDay", () => {
  it("names a source from what the report prints, stripped of the address around it", () => {
    expect(reportedSource("https://www.mjtpeptides.com/")).toEqual({ key: "_mjtpeptides-com", name: "mjtpeptides.com" });
    expect(reportedSource("OUROPEPTIDES.com")).toEqual({ key: "_ouropeptides-com", name: "ouropeptides.com" });
    expect(reportedSource("  Aura ")).toEqual({ key: "_aura", name: "Aura" });
    expect(reportedSource("Peptide Sciences, LLC")).toEqual({ key: "_peptide-sciences-llc", name: "Peptide Sciences, LLC" });
  });

  it("treats a report that names nobody as naming nobody", () => {
    for (const raw of ["", "  ", "Unknown", "unknown", "N/A", "n/a", "none", "-", "—", "?", "Not stated", null, undefined, "!!!"]) expect(reportedSource(raw), String(raw)).toBeNull();
  });

  it("never yields a key that could be a vendor slug", () => {
    for (const raw of ["acme-peptides", "Acme Peptides", "https://acme-peptides.com"]) expect(reportedSource(raw)!.key).toMatch(/^_[a-z0-9-]+$/);
  });

  it("reads a printed date as a calendar day, or as nothing", () => {
    expect(reportDay("2026-09-10")).toBe("2026-09-10");
    expect(reportDay("2026-09-10T23:59:00.000Z")).toBe("2026-09-10");
    expect(reportDay("10 Sep 2026")).toBe("2026-09-10");
    expect(reportDay(new Date("2026-09-10T12:00:00.000Z"))).toBe("2026-09-10");
    for (const raw of [null, undefined, "", "see report", "pending"]) expect(reportDay(raw)).toBeNull();
  });

  it("prints one purity figure as itself and several as a spread", () => {
    expect(formatPurityRange({ purityCount: 1, purityMin: 99.12, purityMax: 99.12 })).toBe("99.1%");
    expect(formatPurityRange({ purityCount: 3, purityMin: 98.34, purityMax: 99.96 })).toBe("98.3–100.0%");
    expect(formatPurityRange({ purityCount: 2, purityMin: 99.11, purityMax: 99.14 })).toBe("99.1%");
    expect(formatPurityRange({ purityCount: 0, purityMin: null, purityMax: null })).toBeNull();
  });
});

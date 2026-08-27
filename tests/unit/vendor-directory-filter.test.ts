import { describe, expect, it } from "vitest";
import {
  VENDOR_KIND_FACETS,
  filterVendorEntries,
  hasActiveVendorFilters,
  offeredVendorKinds,
  type VendorDirectoryFilters,
} from "@/lib/vendor-directory-filter";
import type { VendorDirectoryEntry } from "@/lib/vendor-ranking";

function entry(over: {
  slug: string;
  name: string;
  location?: string;
  kind?: "storefront" | "manufacturer";
  description?: string;
}): VendorDirectoryEntry {
  return {
    vendor: {
      slug: over.slug,
      name: over.name,
      location: over.location ?? "",
      kind: over.kind ?? "storefront",
      description: over.description ?? "",
    } as never,
    priceIndex: null,
    pricedListings: 0,
    enforcement: null,
    defunct: false,
    integrityFlagged: false,
    reviewSentiment: null,
    verdict: "trusted",
    redFlag: false,
  };
}

// A spread over the shape the directory really produces: both vendor kinds, vendors whose display
// name and slug differ in spacing and punctuation, one with no published location, and names that
// share a word ("Peptide") so a query can be shown to cut rather than collapse.
const CORPUS: VendorDirectoryEntry[] = [
  entry({ slug: "swiss-chems", name: "Swiss Chems", location: "United States", description: "Sells peptides and SARMs." }),
  entry({ slug: "peptide-sciences", name: "Peptide Sciences", location: "United States (San Diego, CA)" }),
  entry({ slug: "nordic-peptides", name: "Nordic Peptides", location: "Denmark" }),
  entry({ slug: "coastal-research", name: "Coastal Research", location: "", description: "Compares itself to Swiss Chems on every page." }),
  entry({ slug: "polypeptide-group", name: "PolyPeptide Group", location: "Belgium", kind: "manufacturer" }),
  entry({ slug: "bachem", name: "Bachem", location: "Switzerland (Bubendorf)", kind: "manufacturer" }),
];

const slugs = (list: VendorDirectoryEntry[]) => list.map((e) => e.vendor.slug);

describe("filterVendorEntries", () => {
  it("matches the vendor name", () => {
    expect(slugs(filterVendorEntries(CORPUS, { query: "Nordic" }))).toEqual(["nordic-peptides"]);
  });

  it("matches the slug, which is what the URL and a forum link show a buyer", () => {
    expect(slugs(filterVendorEntries(CORPUS, { query: "polypeptide-group" }))).toEqual(["polypeptide-group"]);
  });

  it("matches the stated location", () => {
    expect(slugs(filterVendorEntries(CORPUS, { query: "Denmark" }))).toEqual(["nordic-peptides"]);
    expect(slugs(filterVendorEntries(CORPUS, { query: "san diego" }))).toEqual(["peptide-sciences"]);
  });

  it("matches a name typed without its spacing or punctuation", () => {
    // The buyer arrives from a forum post that wrote it "swisschems", or from our own URL.
    expect(slugs(filterVendorEntries(CORPUS, { query: "swisschems" }))).toEqual(["swiss-chems"]);
    expect(slugs(filterVendorEntries(CORPUS, { query: "Swiss Chems" }))).toEqual(["swiss-chems"]);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(slugs(filterVendorEntries(CORPUS, { query: "  bAcHeM " }))).toEqual(["bachem"]);
  });

  it("does not search vendor marketing copy", () => {
    // Coastal Research's own description name-drops Swiss Chems. Searching descriptions would put
    // a competitor at the top of a search for the vendor a buyer was actually asking about.
    expect(slugs(filterVendorEntries(CORPUS, { query: "swiss chems" }))).toEqual(["swiss-chems"]);
  });

  it("returns nothing for a vendor that is not on the record", () => {
    // Absence is a fact about our coverage, not a verdict — but it must not silently return rows.
    expect(filterVendorEntries(CORPUS, { query: "zzz-not-a-vendor" })).toEqual([]);
  });

  it("does not treat a punctuation-only query as a match on everything", () => {
    // Collapsing separators reduces "-" to the empty string, and "".includes("") is true for every
    // row — the collapsed path must not fire on an empty collapsed query.
    expect(filterVendorEntries(CORPUS, { query: "---" })).toEqual([]);
  });

  it("filters by vendor kind", () => {
    expect(slugs(filterVendorEntries(CORPUS, { kind: "manufacturer" }))).toEqual(["polypeptide-group", "bachem"]);
    expect(slugs(filterVendorEntries(CORPUS, { kind: "storefront" }))).toEqual(["swiss-chems", "peptide-sciences", "nordic-peptides", "coastal-research"]);
  });

  it("treats an unknown or 'all' kind as no kind filter", () => {
    expect(filterVendorEntries(CORPUS, { kind: "all" }).length).toBe(CORPUS.length);
    expect(filterVendorEntries(CORPUS, { kind: "nonsense" }).length).toBe(CORPUS.length);
  });

  it("intersects the query with the kind rather than unioning them", () => {
    // "Peptide" alone matches three rows across both kinds. Adding a kind must SHRINK the result,
    // never grow it — a union would mean adding a filter adds results.
    expect(slugs(filterVendorEntries(CORPUS, { query: "peptide" }))).toEqual(["peptide-sciences", "nordic-peptides", "polypeptide-group"]);
    expect(slugs(filterVendorEntries(CORPUS, { query: "peptide", kind: "manufacturer" }))).toEqual(["polypeptide-group"]);
    expect(filterVendorEntries(CORPUS, { query: "bachem", kind: "storefront" })).toEqual([]);
  });

  it("returns everything when no filter is set", () => {
    expect(filterVendorEntries(CORPUS, {}).length).toBe(CORPUS.length);
  });
});

describe("hasActiveVendorFilters", () => {
  it("treats a whitespace-only query and the 'all' kind as no filter", () => {
    expect(hasActiveVendorFilters({ query: "   " })).toBe(false);
    expect(hasActiveVendorFilters({ kind: "all" })).toBe(false);
    expect(hasActiveVendorFilters({})).toBe(false);
    expect(hasActiveVendorFilters({ query: "swiss" })).toBe(true);
    expect(hasActiveVendorFilters({ kind: "manufacturer" })).toBe(true);
  });
});

describe("offeredVendorKinds", () => {
  it("offers a kind with its true count over the whole directory", () => {
    const offered = offeredVendorKinds(CORPUS);
    expect(offered.map((option) => option.id)).toEqual(["storefront", "manufacturer"]);
    expect(offered.find((option) => option.id === "storefront")?.count).toBe(4);
    expect(offered.find((option) => option.id === "manufacturer")?.count).toBe(2);
  });

  it("never offers a kind that would return nothing", () => {
    const shopsOnly = CORPUS.filter((e) => e.vendor.kind === "storefront");
    expect(offeredVendorKinds(shopsOnly).map((option) => option.id)).not.toContain("manufacturer");
    expect(offeredVendorKinds([]).length).toBe(0);
  });

  // The guard that matters: a chip which matches EVERY row is not a filter, it is a button that
  // redraws the same page. Offering one teaches a reader that the controls do nothing, which is the
  // same failure as offering one that returns nothing.
  it("never offers a kind that matches every vendor", () => {
    const shopsOnly = CORPUS.filter((e) => e.vendor.kind === "storefront");
    expect(offeredVendorKinds(shopsOnly).map((option) => option.id)).not.toContain("storefront");
    expect(offeredVendorKinds(shopsOnly).length).toBe(0);

    const makersOnly = CORPUS.filter((e) => e.vendor.kind === "manufacturer");
    expect(offeredVendorKinds(makersOnly).length).toBe(0);

    expect(offeredVendorKinds([CORPUS[0]]).length).toBe(0);
  });

  it("keeps every offered kind a real cut of the directory", () => {
    const offered = offeredVendorKinds(CORPUS);
    expect(offered.length).toBeGreaterThan(0);
    for (const option of offered) {
      const filters: VendorDirectoryFilters = { kind: option.id };
      const hits = filterVendorEntries(CORPUS, filters).length;
      expect(hits, `kind ${option.id} matches no vendor`).toBeGreaterThan(0);
      expect(hits, `kind ${option.id} matches every vendor`).toBeLessThan(CORPUS.length);
      expect(hits, `kind ${option.id} count disagrees with the filter it drives`).toBe(option.count);
    }
  });

  it("covers every kind the directory can hold", () => {
    // If the corpus above ever stops spanning the real `vendor.kind` domain, the facets are being
    // tested against a shape the directory does not produce.
    const kinds = new Set(CORPUS.map((e) => e.vendor.kind));
    for (const facet of VENDOR_KIND_FACETS) expect(kinds).toContain(facet.id);
  });
});

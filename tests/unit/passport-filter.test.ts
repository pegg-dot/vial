import { describe, expect, it } from "vitest";
import {
  PASSPORT_EVIDENCE_FACETS,
  PASSPORT_ORIGIN_FACETS,
  PASSPORT_SAMPLING_WORDS,
  filterPassports,
  hasActivePassportFilters,
  offeredPassportFacets,
  type PassportRow,
} from "@/lib/passport-filter";

function row(over: Partial<PassportRow> = {}): PassportRow {
  return {
    id: "p1",
    slug: "hx-bpc-2607",
    declared_batch_code: "HX-BPC-2607",
    origin: "demo",
    sampling_level: "S3",
    evidence_confidence: 0.82,
    compound_slug: "bpc-157",
    vendor_name: "Helix Biotics",
    vendor_slug: "helix",
    product_name: "BPC-157 5mg",
    compound_name: "BPC-157",
    evidence_links: 2,
    open_conflicts: 0,
    ...over,
  };
}

// A spread over the column domains the rows really carry: every sampling level the product has
// words for (S1–S4), both origins, and passports with zero, one and several tests on record.
// COUNT() arrives as a string from node-postgres and a number from PGlite, so both appear here.
const CORPUS: PassportRow[] = [
  row({ id: "a", slug: "hx-bpc-2607", declared_batch_code: "HX-BPC-2607", sampling_level: "S3", origin: "demo", evidence_links: 2, open_conflicts: 1 }),
  row({ id: "b", slug: "hx-tb5-1180", declared_batch_code: "HX-TB5-1180", sampling_level: "S1", origin: "demo", evidence_links: 1, open_conflicts: 0, compound_name: "TB-500", compound_slug: "tb-500", product_name: "TB-500 5mg" }),
  row({ id: "c", slug: "jn-sema-9931", declared_batch_code: "JN/SEMA/9931", sampling_level: "S2", origin: "live", evidence_links: "3", open_conflicts: "0", vendor_name: "Nordic Peptides", vendor_slug: "nordic-peptides", compound_name: "Semaglutide", compound_slug: "semaglutide", product_name: null }),
  row({ id: "d", slug: "jn-reta-4402", declared_batch_code: "RETA4402", sampling_level: "S4", origin: "live", evidence_links: "0", open_conflicts: "2", vendor_name: null, vendor_slug: null, compound_name: "Retatrutide", compound_slug: "retatrutide", product_name: null }),
  row({ id: "e", slug: "jn-ipa-7715", declared_batch_code: "IPA-7715", sampling_level: "D0", origin: "live", evidence_links: 1, open_conflicts: 0, vendor_name: "Coastal Research", vendor_slug: "coastal-research", compound_name: "Ipamorelin", compound_slug: "ipamorelin", product_name: null }),
];

describe("filterPassports", () => {
  it("matches the batch code exactly as printed", () => {
    expect(filterPassports(CORPUS, { query: "HX-BPC-2607" }).map((r) => r.id)).toEqual(["a"]);
  });

  it("matches a batch code typed without its separators", () => {
    // The reader transcribes off a vial label or a COA PDF; they will not reproduce the
    // punctuation. "jnsema9931" must still find JN/SEMA/9931.
    expect(filterPassports(CORPUS, { query: "jnsema9931" }).map((r) => r.id)).toEqual(["c"]);
    expect(filterPassports(CORPUS, { query: "hx bpc 2607" }).map((r) => r.id)).toEqual(["a"]);
  });

  it("matches the compound name", () => {
    expect(filterPassports(CORPUS, { query: "retatrutide" }).map((r) => r.id)).toEqual(["d"]);
  });

  it("matches the vendor name and the vendor slug", () => {
    expect(filterPassports(CORPUS, { query: "Nordic Peptides" }).map((r) => r.id)).toEqual(["c"]);
    expect(filterPassports(CORPUS, { query: "coastal-research" }).map((r) => r.id)).toEqual(["e"]);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(filterPassports(CORPUS, { query: "  iPaMoReLiN " }).map((r) => r.id)).toEqual(["e"]);
  });

  it("returns nothing for a code that is not on the record", () => {
    // Absence of a record is not a finding about the batch, but it must not silently return rows.
    expect(filterPassports(CORPUS, { query: "ZZ-0000" })).toEqual([]);
  });

  it("does not treat a punctuation-only query as a match on everything", () => {
    // Collapsing separators reduces "-" to the empty string, and "".includes("") is true for
    // every row — the code-match path must not fire on an empty collapsed query.
    expect(filterPassports(CORPUS, { query: "///" })).toEqual([]);
  });

  it("filters by origin", () => {
    expect(filterPassports(CORPUS, { origins: ["live"] }).map((r) => r.id)).toEqual(["c", "d", "e"]);
    expect(filterPassports(CORPUS, { origins: ["demo"] }).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("unions the selected chips inside one dimension", () => {
    expect(filterPassports(CORPUS, { origins: ["live", "demo"] }).map((r) => r.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("filters to passports whose results still disagree", () => {
    expect(filterPassports(CORPUS, { evidence: ["disagreement"] }).map((r) => r.id)).toEqual(["a", "d"]);
  });

  it("filters to passports with more than one test on record", () => {
    expect(filterPassports(CORPUS, { evidence: ["corroborated"] }).map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("filters to blind-bought samples, not vendor-picked ones", () => {
    expect(filterPassports(CORPUS, { evidence: ["blind"] }).map((r) => r.id)).toEqual(["a", "d"]);
  });

  it("counts a string COUNT() the same as a numeric one", () => {
    // node-postgres returns COUNT() as a string; PGlite returns a number. "0" is falsy-adjacent
    // enough to invert a > 0 test if it is ever compared without Number().
    expect(filterPassports([row({ id: "s", open_conflicts: "2", evidence_links: "2" })], { evidence: ["disagreement"] }).map((r) => r.id)).toEqual(["s"]);
    expect(filterPassports([row({ id: "s", open_conflicts: "0", evidence_links: "0" })], { evidence: ["disagreement", "corroborated"] })).toEqual([]);
  });

  it("intersects across dimensions rather than unioning them", () => {
    // 'a' disagrees but is demo; 'c' is live but agrees. Neither satisfies both, so adding the
    // second dimension must SHRINK the result to nothing, never grow it.
    expect(filterPassports(CORPUS, { origins: ["demo"], evidence: ["disagreement"] }).map((r) => r.id)).toEqual(["a"]);
    expect(filterPassports(CORPUS, { origins: ["demo"], evidence: ["corroborated"] }).map((r) => r.id)).toEqual(["a"]);
    expect(filterPassports(CORPUS, { query: "semaglutide", origins: ["demo"] })).toEqual([]);
  });

  it("intersects the query with the facets", () => {
    expect(filterPassports(CORPUS, { query: "helix", evidence: ["blind"] }).map((r) => r.id)).toEqual(["a"]);
    expect(filterPassports(CORPUS, { query: "helix", origins: ["live"] })).toEqual([]);
  });

  it("returns everything when no filter is set", () => {
    expect(filterPassports(CORPUS, {}).length).toBe(CORPUS.length);
  });
});

describe("hasActivePassportFilters", () => {
  it("treats a whitespace-only query as no filter", () => {
    expect(hasActivePassportFilters({ query: "   " })).toBe(false);
    expect(hasActivePassportFilters({ query: "bpc" })).toBe(true);
    expect(hasActivePassportFilters({ origins: ["live"] })).toBe(true);
    expect(hasActivePassportFilters({ evidence: ["blind"] })).toBe(true);
    expect(hasActivePassportFilters({})).toBe(false);
  });
});

describe("offeredPassportFacets", () => {
  const ALL_FACETS = [...PASSPORT_ORIGIN_FACETS, ...PASSPORT_EVIDENCE_FACETS];

  it("offers a facet with its true count over the whole set", () => {
    const offered = offeredPassportFacets(PASSPORT_EVIDENCE_FACETS, CORPUS);
    expect(offered.find((option) => option.id === "disagreement")?.count).toBe(2);
    expect(offered.find((option) => option.id === "corroborated")?.count).toBe(2);
    expect(offered.find((option) => option.id === "blind")?.count).toBe(2);
  });

  it("never offers a facet that would return nothing", () => {
    const settled = CORPUS.map((r) => ({ ...r, open_conflicts: 0 }));
    expect(offeredPassportFacets(PASSPORT_EVIDENCE_FACETS, settled).map((option) => option.id)).not.toContain("disagreement");
    expect(offeredPassportFacets(ALL_FACETS, []).length).toBe(0);
  });

  // The guard that matters: a chip which matches EVERY row is not a filter, it is a button that
  // redraws the same page. Offering one teaches a reader that the controls do nothing, which is
  // the same failure as offering one that returns nothing.
  it("never offers a facet that matches every row", () => {
    const allDisagree = CORPUS.map((r) => ({ ...r, open_conflicts: 3 }));
    expect(offeredPassportFacets(PASSPORT_EVIDENCE_FACETS, allDisagree).map((option) => option.id)).not.toContain("disagreement");

    const allLive = CORPUS.map((r) => ({ ...r, origin: "live" }));
    const liveOnly = offeredPassportFacets(PASSPORT_ORIGIN_FACETS, allLive).map((option) => option.id);
    expect(liveOnly).not.toContain("live");
    expect(liveOnly).not.toContain("demo");

    expect(offeredPassportFacets(ALL_FACETS, [row()]).length).toBe(0);
  });

  it("keeps every offered facet a real cut of the corpus", () => {
    const offered = offeredPassportFacets(ALL_FACETS, CORPUS);
    expect(offered.length).toBeGreaterThan(0);
    for (const option of offered) {
      const hits = filterPassports(CORPUS, option.id === "live" || option.id === "demo"
        ? { origins: [option.id] }
        : { evidence: [option.id as "disagreement" | "corroborated" | "blind"] }).length;
      expect(hits, `facet ${option.id} matches no row`).toBeGreaterThan(0);
      expect(hits, `facet ${option.id} matches every row`).toBeLessThan(CORPUS.length);
      expect(hits, `facet ${option.id} count disagrees with the filter it drives`).toBe(option.count);
    }
  });

  it("covers every sampling level the product has words for", () => {
    // If the corpus above ever stops spanning the real sampling domain, the "blind" facet is being
    // tested against a shape the database does not produce.
    const levels = new Set(CORPUS.map((r) => String(r.sampling_level)));
    for (const code of Object.keys(PASSPORT_SAMPLING_WORDS)) expect(levels).toContain(code);
  });
});

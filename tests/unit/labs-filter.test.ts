import { describe, expect, it } from "vitest";
import { LAB_REGISTRY } from "@/server/labs/registry";
import {
  LAB_INDEPENDENCE_FACETS,
  filterLabs,
  hasActiveLabFilters,
  isLabIndependenceId,
  labHasEvidence,
  offeredLabFacets,
  partitionLabsByEvidence,
  type LabFilterRow,
} from "@/lib/labs-filter";

const row = (over: Partial<LabFilterRow> = {}): LabFilterRow => ({
  slug: "janoshik-analytical",
  independence: "independent",
  coaCount: 12,
  ...over,
});

// The real registry, projected to the three fields the facets read. Testing the facet table against
// invented tiers would prove nothing about the page it drives.
const CORPUS: LabFilterRow[] = LAB_REGISTRY.map((profile, index) => ({
  slug: profile.slug,
  independence: profile.independence,
  // Alternating so the corpus spans both evidence states; the real counts come from the database.
  coaCount: index % 3 === 0 ? 0 : index * 4,
}));

describe("filterLabs", () => {
  it("filters to one independence tier", () => {
    const independent = filterLabs(CORPUS, { independence: "independent" });
    expect(independent.length).toBeGreaterThan(0);
    expect(independent.every((lab) => lab.independence === "independent")).toBe(true);
  });

  it("returns every lab when no tier is chosen", () => {
    expect(filterLabs(CORPUS, {}).length).toBe(CORPUS.length);
  });

  it("treats an unknown tier as no filter rather than emptying the page", () => {
    // The value arrives off the URL, where anyone can type anything. An unrecognised tier must not
    // produce a blank directory that reads as "we hold no labs".
    expect(filterLabs(CORPUS, { independence: "gold-standard" }).length).toBe(CORPUS.length);
    expect(filterLabs(CORPUS, { independence: "" }).length).toBe(CORPUS.length);
  });

  it("recognises exactly the tiers the registry can hold", () => {
    expect(isLabIndependenceId("independent")).toBe(true);
    expect(isLabIndependenceId("independence-unverified")).toBe(true);
    expect(isLabIndependenceId("unverified")).toBe(true);
    expect(isLabIndependenceId("accredited")).toBe(false);
    expect(isLabIndependenceId(undefined)).toBe(false);
  });

  it("hasActiveLabFilters is only true for a tier that exists", () => {
    expect(hasActiveLabFilters({})).toBe(false);
    expect(hasActiveLabFilters({ independence: "nonsense" })).toBe(false);
    expect(hasActiveLabFilters({ independence: "unverified" })).toBe(true);
  });
});

describe("labHasEvidence", () => {
  // The defect: /labs mapped the WHOLE registry and defaulted missing usage to {coaCount: 0,
  // vendorCount: 0}, so a lab we hold nothing from rendered a full card reading "Certificates 0 /
  // Vendors 0" — a zero in the slot where another lab shows hundreds, which reads as a measurement
  // of the lab rather than a statement about our records.
  it("is false for a lab we hold no certificate from", () => {
    expect(labHasEvidence(row({ coaCount: 0 }))).toBe(false);
  });

  it("is true from the very first certificate", () => {
    expect(labHasEvidence(row({ coaCount: 1 }))).toBe(true);
  });

  it("splits a set into the labs we hold evidence from and the ones we do not, losing none", () => {
    const { tested, untested } = partitionLabsByEvidence(CORPUS);
    expect(tested.length).toBeGreaterThan(0);
    expect(untested.length).toBeGreaterThan(0);
    expect(tested.length + untested.length).toBe(CORPUS.length);
    expect(tested.every((lab) => lab.coaCount > 0)).toBe(true);
    expect(untested.every((lab) => lab.coaCount === 0)).toBe(true);
    // Every registered lab is still reachable: hiding one would delete a sourced profile from the
    // only page that carries it.
    expect([...tested, ...untested].map((lab) => lab.slug).sort()).toEqual(CORPUS.map((lab) => lab.slug).sort());
  });
});

describe("offeredLabFacets", () => {
  it("offers each tier with its true count over the whole registry", () => {
    const offered = offeredLabFacets(CORPUS);
    expect(offered.length).toBeGreaterThan(0);
    for (const option of offered) {
      expect(option.count).toBe(CORPUS.filter((lab) => lab.independence === option.id).length);
    }
  });

  it("never offers a tier that would return nothing", () => {
    const independentOnly = CORPUS.filter((lab) => lab.independence === "independent");
    expect(offeredLabFacets(independentOnly).map((option) => option.id)).not.toContain("unverified");
    expect(offeredLabFacets([]).length).toBe(0);
  });

  // The guard that matters: a chip which matches EVERY row is not a filter, it is a button that
  // redraws the same page. Offering one teaches a reader that the controls do nothing, which is the
  // same failure as offering one that returns nothing.
  it("never offers a tier that matches every lab", () => {
    const independentOnly = CORPUS.filter((lab) => lab.independence === "independent");
    expect(offeredLabFacets(independentOnly).map((option) => option.id)).not.toContain("independent");
    expect(offeredLabFacets(independentOnly).length).toBe(0);
    expect(offeredLabFacets([row()]).length).toBe(0);
  });

  it("keeps every offered tier a real cut of the registry", () => {
    const offered = offeredLabFacets(CORPUS);
    for (const option of offered) {
      const hits = filterLabs(CORPUS, { independence: option.id }).length;
      expect(hits, `tier ${option.id} matches no lab`).toBeGreaterThan(0);
      expect(hits, `tier ${option.id} matches every lab`).toBeLessThan(CORPUS.length);
      expect(hits, `tier ${option.id} count disagrees with the filter it drives`).toBe(option.count);
    }
  });

  it("covers every tier the registry actually holds", () => {
    // If the registry ever stops spanning the declared tiers, the facets are being tested against a
    // shape the page does not produce — and one of the chips is dead in production.
    const tiers = new Set(LAB_REGISTRY.map((profile) => profile.independence));
    for (const facet of LAB_INDEPENDENCE_FACETS) expect(tiers, `no registry lab is ${facet.id}`).toContain(facet.id);
  });

  it("the real registry is not one single tier, so the filter is worth rendering at all", () => {
    const tiers = new Set(LAB_REGISTRY.map((profile) => profile.independence));
    expect(tiers.size).toBeGreaterThan(1);
  });
});

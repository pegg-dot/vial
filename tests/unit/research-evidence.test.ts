import { describe, expect, it } from "vitest";
import { citationPack, evidenceCaveats, evidenceItems, filterByRegistryMatch } from "@/lib/research-evidence";
import type { ResearchDossier } from "@/server/intelligence/public-dossiers";

const dossier: ResearchDossier = {
  key: "retatrutide",
  label: "Retatrutide",
  trials: {
    key: "retatrutide",
    label: "Retatrutide",
    checkedAt: "2026-10-17T00:00:00.000Z",
    unavailable: false,
    studies: [
      { nctId: "NCT12345678", title: "An illustrative registry record", status: "RECRUITING", phase: "PHASE_2", sponsor: "A research sponsor", lastUpdated: "2026-08-31", resultsReported: false },
    ],
  },
  publications: {
    key: "retatrutide",
    label: "Retatrutide",
    checkedAt: "2026-10-17T00:00:00.000Z",
    unavailable: false,
    works: [
      { id: "https://openalex.org/W1234", title: "Illustrative journal paper", published: "2026-10-01", doiUrl: "https://doi.org/10.1234/example", kind: "article", venue: "Example Journal", retracted: false },
      { id: "https://openalex.org/W8888", title: "A retracted report", published: "2025-10-01", doiUrl: null, kind: "preprint", venue: null, retracted: true },
    ],
  },
};

describe("traceable research dossier rules", () => {
  it("sorts by source document dates without promoting a result as verified science", () => {
    const entries = evidenceItems(dossier);
    expect(entries.map(e => e.id)).toEqual(["https://openalex.org/W1234", "NCT12345678", "https://openalex.org/W8888"]);
    expect(entries[2].retracted).toBe(true);
    expect(entries[0].url).toBe("https://doi.org/10.1234/example");
    expect(entries[1].details).toContain("Registry");
    expect(entries[1].details).toContain("results section not reported");
  });

  it("exports a reproducible source register with primary identifiers and warnings", () => {
    const exported = citationPack(dossier, "2026-10-17T12:00:00.000Z");
    expect(exported).toContain("NCT12345678");
    expect(exported).toContain("https://doi.org/10.1234/example");
    expect(exported).toContain("RETRACTION FLAG");
    expect(exported).toContain("not a systematic review");
    expect(exported).not.toContain("medical advice to take");
  });

  it("filters by the literal registered match location without implying a clinical rank", () => {
    const annotated: ResearchDossier = {
      ...dossier,
      trials: {
        ...dossier.trials,
        studies: [
          { ...dossier.trials.studies[0], association: "intervention-recorded" },
          { ...dossier.trials.studies[0], nctId: "NCT12345679", association: "named-in-title" },
          { ...dossier.trials.studies[0], nctId: "NCT12345680", association: "search-hit-only" },
        ],
      },
    };
    const all = evidenceItems(annotated);
    expect(all).toHaveLength(5);
    expect(filterByRegistryMatch(all, "all")).toHaveLength(5);
    expect(filterByRegistryMatch(all, "intervention-recorded").map(item => item.id)).toEqual(["NCT12345678"]);
    expect(filterByRegistryMatch(all, "named-in-title").map(item => item.id)).toEqual(["NCT12345679"]);
    expect(filterByRegistryMatch(all, "search-hit-only").map(item => item.id)).toEqual(["NCT12345680"]);
    expect(filterByRegistryMatch(all, "intervention-recorded").every(item => item.kind === "trial")).toBe(true);
    expect(filterByRegistryMatch(evidenceItems(dossier), "search-hit-only")).toEqual([]);
  });

  it("never treats provider downtime as absent evidence", () => {
    const lost: ResearchDossier = {
      ...dossier,
      trials: { ...dossier.trials, unavailable: true, studies: [] },
      publications: { ...dossier.publications, unavailable: true, works: [] },
    };
    expect(evidenceCaveats(lost)).toEqual(expect.arrayContaining([
      expect.stringContaining("unavailable"),
      expect.stringContaining("rate-limited"),
      expect.stringContaining("search-result samples"),
    ]));
    const exportText = citationPack(lost);
    expect(exportText).toContain("Source temporarily unavailable; no conclusions drawn.");
  });
});

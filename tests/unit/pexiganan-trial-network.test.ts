import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudyLookup } from "@/server/intelligence/study-lookup";

const { mockLookup } = vi.hoisted(() => ({
  mockLookup: vi.fn(),
}));
vi.mock("@/server/intelligence/study-lookup", () => ({
  lookupStudy: mockLookup,
}));

import { getPexigananTrialEvidence } from "@/server/intelligence/pexiganan-network";

const selection = ["NCT01594762", "NCT01590758", "NCT00563394", "NCT00563433"];

function lookup(nctId: string, interventions: string[], sponsor = "Test sponsor"): StudyLookup {
  return {
    state: "available",
    nctId,
    checkedAt: "2026-10-19T14:30:00.000Z",
    study: {
      nctId, title: "Test registry record", url: "https://clinicaltrials.gov/study/" + nctId,
      sponsor, phase: "PHASE3", status: "COMPLETED",
      enrollment: { count: 200, precision: "ACTUAL" }, primaryCompletion: null,
      lastRegistryUpdate: "2020-09-03",
      interventions,
      primaryOutcomes: [{ measure: "Registered study outcome", timeFrame: "28 days" }],
      primaryOutcomeCount: 1,
      population: {
        conditions: [], sex: null, minimumAge: null, maximumAge: null,
        healthyVolunteers: null, armLabels: [],
      },
      registryResults: "not-shown",
      registryReferences: [],
      pubmedChecks: [],
    },
  };
}

describe("Pexiganan live registry projection", () => {
  beforeEach(() => { mockLookup.mockReset(); });

  it("requires exact NCT ID and intervention name before calling a row matched", async () => {
    mockLookup.mockImplementation(async (id: string) => lookup(id, [
      id.startsWith("NCT015") ? "Topical pexiganan cream 0.8%" : "MSI-78",
    ]));
    const rows = await getPexigananTrialEvidence();
    expect(rows).toHaveLength(4);
    expect(mockLookup.mock.calls.map(args => args[0])).toEqual(selection);
    expect(rows.every(row => row.state === "matched")).toBe(true);
    if (rows[0]?.state !== "matched") return;
    expect(rows[0].matchedIntervention).toContain("pexiganan");
    expect(rows[0].primaryOutcomes).toEqual(["Registered study outcome"]);
    expect(rows[0].sourceUrl).toBe("https://clinicaltrials.gov/study/NCT01594762");
  });

  it("fails closed on unrelated intervention, wrong NCT and provider failure", async () => {
    mockLookup.mockImplementation(async (id: string): Promise<StudyLookup> => {
      if (id === "NCT01594762") return lookup(id, ["Topical placebo cream"]);
      if (id === "NCT01590758") return lookup("NCT00000000", ["pexiganan"]);
      if (id === "NCT00563394") return { state: "unavailable", nctId: id, checkedAt: "2026-10-19T00:00:00Z" };
      return lookup(id, ["MSI-78"]);
    });
    const rows = await getPexigananTrialEvidence();
    expect(rows.map(row => row.state)).toEqual([
      "identity-not-verified",
      "identity-not-verified",
      "unavailable",
      "matched",
    ]);
    expect(rows[0]).not.toHaveProperty("sponsor");
    expect(rows[2]).not.toHaveProperty("registryResults");
  });

  it("preserves publication role and noncorroboration instead of converting a DERIVED citation to results", async () => {
    mockLookup.mockImplementation(async (id: string): Promise<StudyLookup> => {
      const record = lookup(id, ["MSI-78"]);
      if (record.state !== "available" || id !== "NCT00563394") return record;
      return {
        ...record,
        study: {
          ...record.study,
          registryReferences: [{ pmid: "18990064", role: "DERIVED", citation: "Registry paper" }],
          pubmedChecks: [{
            nctId: id, reference: { pmid: "18990064", role: "DERIVED", citation: "Registry paper" },
            article: { pmid: "18990064", title: "A randomized trial article", journal: "Journal", publicationDate: "2008", url: "https://pubmed.ncbi.nlm.nih.gov/18990064/" },
            secondaryIdMatch: "not-corroborated",
          }],
        },
      };
    });
    const rows = await getPexigananTrialEvidence();
    const r = rows.find(row => row.selected.nctId === "NCT00563394");
    expect(r?.state).toBe("matched");
    if (!r || r.state !== "matched") return;
    expect(r.citations).toEqual([{
      pmid: "18990064", role: "DERIVED", exactNctAssociation: "not-corroborated", pubmedTitle: "A randomized trial article",
    }]);
    expect(r.registryResults).toBe("not-shown");
  });
});

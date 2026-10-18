import { afterEach, describe, expect, it, vi } from "vitest";
import { evidenceItems, registryMatchNote } from "@/lib/research-evidence";
import { getTopicTrials, PUBLIC_RESEARCH_TOPICS } from "@/server/intelligence/public-trials";
import type { ResearchDossier } from "@/server/intelligence/public-dossiers";

afterEach(() => vi.unstubAllGlobals());

function sampleStudy(id: string, title: string, intervention: string) {
  return {
    protocolSection: {
      identificationModule: { nctId: id, briefTitle: title },
      statusModule: { overallStatus: "COMPLETED", lastUpdatePostDateStruct: { date: "2026-10-01" } },
      armsInterventionsModule: { interventions: [{ name: intervention }] },
    },
    hasResults: false,
  };
}

describe("public research trial match-location disclosure", () => {
  it("annotates the existing fixed-query sample without adding alias API calls", async () => {
    const fetchStub = vi.fn().mockResolvedValue(new Response(JSON.stringify({ studies: [
      sampleStudy("NCT00000011", "An older code study", "NNC0174-0833"),
      sampleStudy("NCT00000012", "Another product development study", "NNC0113-2023"),
      sampleStudy("NCT00000013", "A trial titled NNC0174-0833", "Placebo"),
    ] }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchStub);

    const trials = await getTopicTrials(PUBLIC_RESEARCH_TOPICS[1]);
    expect(trials.unavailable).toBe(false);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    const query = new URL(fetchStub.mock.calls[0][0] as string);
    expect(query.searchParams.get("query.term")).toBe("Cagrilintide");
    expect(query.searchParams.get("pageSize")).toBe("8");
    expect(trials.studies.map(s => s.association)).toEqual([
      "intervention-recorded",
      "search-hit-only",
      "named-in-title",
    ]);
  });

  it("explains uncertainty in the on-screen record and exported source register", () => {
    const dossier: ResearchDossier = {
      key: "cagrilintide", label: "Cagrilintide",
      trials: {
        key: "cagrilintide", label: "Cagrilintide",
        checkedAt: "2026-10-18T00:00:00.000Z", unavailable: false,
        studies: [
          {
            nctId: "NCT00000011", title: "Study mention",
            status: "RECRUITING", phase: "PHASE_2",
            sponsor: "Example", lastUpdated: "2026-10-01",
            resultsReported: false, association: "search-hit-only",
          },
        ],
      },
      publications: {
        key: "cagrilintide", label: "Cagrilintide",
        checkedAt: "2026-10-18T00:00:00.000Z",
        unavailable: false, works: [],
      },
    };
    const [item] = evidenceItems(dossier);
    expect(item.details).toContain("Keyword search hit; compound's role is not confirmed");
    expect(registryMatchNote("intervention-recorded")).toContain("possibly as a comparator");
    expect(registryMatchNote("named-in-title")).toContain("unconfirmed");
  });
});

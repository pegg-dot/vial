import { describe, expect, it } from "vitest";
import { parseTrialRegistryResponse, PUBLIC_RESEARCH_TOPICS } from "@/server/intelligence/public-trials";

const fixture = {
  studies: [
    {
      protocolSection: {
        identificationModule: { nctId: "NCT01234567", briefTitle: "Research registry example" },
        statusModule: { overallStatus: "RECRUITING", lastUpdatePostDateStruct: { date: "2026-09-10" } },
        designModule: { phases: ["PHASE_2"] },
        sponsorCollaboratorsModule: { leadSponsor: { name: "Example institution" } },
      },
      hasResults: false,
    },
    { protocolSection: { identificationModule: { nctId: "javascript:alert(1)", briefTitle: "Bad record" } } },
    { protocolSection: { identificationModule: { nctId: "NCT12345678" } } },
  ],
};

describe("public registry source indexing", () => {
  it("accepts only link-safe NCT IDs with registered study titles", () => {
    const records = parseTrialRegistryResponse(fixture);
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual({
      nctId: "NCT01234567",
      title: "Research registry example",
      status: "RECRUITING",
      phase: "PHASE_2",
      sponsor: "Example institution",
      lastUpdated: "2026-09-10",
      resultsReported: false,
    });
  });
  it("fails closed on missing or malformed third-party data", () => {
    expect(parseTrialRegistryResponse(null)).toEqual([]);
    expect(parseTrialRegistryResponse({ studies: "not an array" })).toEqual([]);
    expect(parseTrialRegistryResponse({ studies: [null, {}, 55] })).toEqual([]);
  });
  it("queries only fixed, publicly chosen research topics", () => {
    expect(PUBLIC_RESEARCH_TOPICS.map((topic) => topic.key)).toEqual(["retatrutide", "cagrilintide", "tirzepatide"]);
  });
});

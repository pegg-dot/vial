import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  RESEARCH_IDENTITY_CANDIDATES,
  classifyTrialAssociation,
  getCandidateQueries,
  getResearchIdentityCandidate,
} from "@/server/intelligence/topic-identity-candidates";

const fixture = JSON.parse(
  readFileSync(new URL("../../scripts/data/peptide-compounds.json", import.meta.url), "utf8"),
) as Array<{ slug: string; name: string; aliases: string[] }>;

function registryStudy({
  briefTitle = "Some unrelated study",
  officialTitle = "",
  names = [] as Array<string | { name: string; otherNames: string[] }>,
} = {}) {
  return {
    protocolSection: {
      identificationModule: { briefTitle, officialTitle },
      armsInterventionsModule: {
        interventions: names.map(value => typeof value === "string" ? { name: value } : value),
      },
    },
  };
}

describe("legacy identity candidates remain quarantined", () => {
  it("uses an explicit three-topic allowlist, not every old marketplace synonym", () => {
    expect(RESEARCH_IDENTITY_CANDIDATES.map(x => x.key)).toEqual([
      "retatrutide",
      "cagrilintide",
      "tirzepatide",
    ]);
    for (const identity of RESEARCH_IDENTITY_CANDIDATES) {
      const legacy = fixture.find(x => x.slug === identity.key);
      expect(legacy).toBeTruthy();
      for (const alias of identity.aliases) {
        expect(legacy?.aliases).toContain(alias.value);
        expect(alias.sourceId).toMatch(/^NCT\d{8}$/);
        expect(alias.sourceUrl).toBe("https://clinicaltrials.gov/study/" + alias.sourceId);
        expect(alias.role).toBe("development-code");
      }
    }
    expect(getCandidateQueries("cagrilintide")).toEqual(["Cagrilintide", "NNC0174-0833"]);
    expect(getCandidateQueries("bpc-157")).toEqual([]);
    expect(getCandidateQueries("Mounjaro")).toEqual([]);
    expect(getResearchIdentityCandidate("not-a-topic")).toBeNull();
  });

  it("identifies a development code as a registered intervention, with formatting variants", () => {
    const topic = getResearchIdentityCandidate("cagrilintide")!;
    expect(classifyTrialAssociation(registryStudy({ names: ["NNC0174-0833"] }), topic))
      .toBe("intervention-recorded");
    expect(classifyTrialAssociation(registryStudy({ names: ["NNC0174 0833 10 mg/mL"] }), topic))
      .toBe("intervention-recorded");
    expect(classifyTrialAssociation(registryStudy({ names: [{
      name: "Cagrilintide", otherNames: ["NNC0174-0833"],
    }] }), topic)).toBe("intervention-recorded");
  });

  it("preserves weaker title-only classification instead of calling it a direct intervention", () => {
    const topic = getResearchIdentityCandidate("retatrutide")!;
    expect(classifyTrialAssociation(registryStudy({
      briefTitle: "A study of LY3437943 in participants",
      names: ["Placebo"],
    }), topic)).toBe("named-in-title");
    expect(classifyTrialAssociation(registryStudy({
      officialTitle: "Retatrutide development study",
      names: ["Some other intervention"],
    }), topic)).toBe("named-in-title");
  });

  it("does not claim a keyword hit proves a study investigates the compound", () => {
    const topic = getResearchIdentityCandidate("cagrilintide")!;
    expect(classifyTrialAssociation(registryStudy({
      briefTitle: "A study of NNC0113-2023 in healthy people",
      names: ["NNC0113-2023", "Placebo"],
    }), topic)).toBe("search-hit-only");
    expect(classifyTrialAssociation(registryStudy({
      briefTitle: "A study of CagriSema",
      names: ["Semaglutide"],
    }), topic)).toBe("search-hit-only");
    expect(classifyTrialAssociation(registryStudy({
      names: ["NNC0174-08330"],
    }), topic)).toBe("search-hit-only");
    expect(classifyTrialAssociation(registryStudy({
      names: ["Some compound", "LY32981760"],
    }), getResearchIdentityCandidate("tirzepatide")!)).toBe("search-hit-only");
    expect(classifyTrialAssociation({ protocolSection: { conditionsModule: { conditions: ["Cagrilintide"] } } }, topic))
      .toBe("search-hit-only");
    expect(classifyTrialAssociation(null, topic)).toBe("search-hit-only");
  });

  it("does not mistake a study record's mention for verified outcomes or approval", () => {
    const topic = getResearchIdentityCandidate("tirzepatide")!;
    expect(classifyTrialAssociation(registryStudy({
      names: [{ name: "Tirzepatide", otherNames: ["LY3298176"] }],
    }), topic)).toBe("intervention-recorded");
    // This category only indicates that the intervention is listed; it is
    // deliberately not named 'efficacy-proven' or 'approved'.
  });
});

import { describe, expect, it } from "vitest";
import { researchSubjectBySlug } from "@/lib/research-explorer";
import { dossierTrialEvidence, dossierTrialWorkpaper } from "@/lib/research-dossier-evidence";
import type { PublicRegistryStudy } from "@/server/intelligence/cagrilintide-study-audit";
import type { StudyLookup } from "@/server/intelligence/study-lookup";
import { guidedCaseMarkdown, guidedCaseSource, MAGAININ_PEXIGANAN_CASE } from "@/lib/research-guided-case";

const subject = researchSubjectBySlug("cagrilintide")!;

function sampleTrial(overrides: Partial<PublicRegistryStudy> = {}): PublicRegistryStudy {
  return {
    nctId: "NCT05804162",
    title: "A Research Study Looking at How Cagrilintide Works on the Heart Rhythm",
    url: "https://clinicaltrials.gov/study/NCT05804162",
    sponsor: "Research sponsor",
    phase: "PHASE1",
    status: "COMPLETED",
    enrollment: { count: 107, precision: "ACTUAL" },
    primaryCompletion: null,
    lastRegistryUpdate: "2024-11-01",
    interventions: ["Cagrilintide", "Moxifloxacin Placebo"],
    primaryOutcomes: [{ measure: "Registered change in QTcF", timeFrame: "72 hours" }],
    primaryOutcomeCount: 1,
    population: {
      conditions: [], sex: "ALL", minimumAge: "18 Years", maximumAge: "60 Years",
      healthyVolunteers: true, armLabels: ["Trial treatment"],
    },
    registryResults: "not-shown",
    registryReferences: [{ pmid: "39279639", role: "RESULT", citation: "Registry source" }],
    pubmedChecks: [{
      nctId: "NCT05804162",
      reference: { pmid: "39279639", role: "RESULT", citation: "Registry source" },
      article: {
        pmid: "39279639", title: "Original clinical trial paper", journal: "Research journal",
        publicationDate: "2024", url: "https://pubmed.ncbi.nlm.nih.gov/39279639/",
      },
      secondaryIdMatch: "confirmed",
    }],
    ...overrides,
  };
}
const available = (study = sampleTrial()): StudyLookup => ({
  state: "available", nctId: "NCT05804162", checkedAt: "2026-10-19T04:00:00.000Z", study,
});

describe("curated trial evidence projection", () => {
  it("keeps result-section state separate from publication linkage", () => {
    const card = dossierTrialEvidence(subject, available());
    expect(card.state).toBe("verified");
    if (card.state !== "verified") return;
    expect(card.hasRegistryResults).toBe("not-shown");
    expect(card.confirmedPubmedLinks).toBe(1);
    expect(card.citations[0]).toMatchObject({ pmid: "39279639", registryRole: "RESULT", exactNct: "confirmed" });
    expect(card.outcomeMeasures).toEqual(["Registered change in QTcF"]);
    expect(card.recordUpdatedAt).toBe("2024-11-01");
    const exportText = dossierTrialWorkpaper(card);
    expect(exportText).toContain("Registry results section: not-shown");
    expect(exportText).toContain("https://pubmed.ncbi.nlm.nih.gov/39279639/");
    expect(exportText).toContain("not proof of a favorable finding");
    expect(exportText).not.toContain("Approved to buy");
  });

  it("does not claim verification for a provider fault, unverified study, wrong NCT or absent intervention", () => {
    const unavailable: StudyLookup = { state: "unavailable", nctId: "NCT05804162", checkedAt: "2026-10-19T04:00:00Z" };
    expect(dossierTrialEvidence(subject, unavailable).state).toBe("unavailable");
    expect(dossierTrialEvidence(subject, { ...available(), nctId: "NCT12345678" }).state).toBe("identity-not-verified");
    expect(dossierTrialEvidence(subject, available(sampleTrial({ nctId: "NCT00000000" }))).state).toBe("identity-not-verified");
    expect(dossierTrialEvidence(subject, available(sampleTrial({ interventions: ["Semaglutide"] }))).state).toBe("identity-not-verified");
    expect(dossierTrialEvidence(subject, available(sampleTrial({ interventions: ["Pre-cagrilintideAnalog"] }))).state).toBe("identity-not-verified");
  });

  it("preserves BACKGROUND vs RESULT and uncorroborated PubMed relationships", () => {
    const noLink = available(sampleTrial({
      registryResults: "present",
      registryReferences: [
        { pmid: "39279639", role: "BACKGROUND", citation: null },
        { pmid: "36781451", role: "DERIVED", citation: null },
      ],
      pubmedChecks: [],
    }));
    const card = dossierTrialEvidence(subject, noLink);
    expect(card.state).toBe("verified");
    if (card.state !== "verified") return;
    expect(card.confirmedPubmedLinks).toBe(0);
    expect(card.hasRegistryResults).toBe("present");
    expect(card.citations.map(ref => ref.registryRole)).toEqual(["BACKGROUND", "DERIVED"]);
    expect(card.citations.every(ref => ref.exactNct === "unavailable")).toBe(true);
    expect(dossierTrialWorkpaper(card)).toContain("A paper cited under BACKGROUND or DERIVED");
  });

  it("requires explicit selection rather than accepting arbitrary user's study lookup", () => {
    const noTrial = researchSubjectBySlug("magainin-2")!;
    expect(() => dossierTrialEvidence(noTrial, available())).toThrow("pinned example");
  });

  it("matches topical pexiganan intervention while keeping unrelated magainin separate", () => {
    const pexiganan = researchSubjectBySlug("pexiganan")!;
    const result = available(sampleTrial({
      nctId: "NCT01594762",
      interventions: ["Topical pexiganan cream 0.8%", "Placebo cream"],
    }));
    const card = dossierTrialEvidence(pexiganan, { ...result, nctId: "NCT01594762" });
    expect(card.state).toBe("verified");
  });
});

describe("original-source guided research workpaper", () => {
  it("has traceable support for every claim and links distinct identity / study sources", () => {
    expect(MAGAININ_PEXIGANAN_CASE.observations).toHaveLength(3);
    expect(MAGAININ_PEXIGANAN_CASE.sources).toHaveLength(5);
    for (const step of MAGAININ_PEXIGANAN_CASE.observations) {
      expect(step.observation.length).toBeGreaterThan(80);
      expect(step.notEstablished.length).toBeGreaterThan(60);
      expect(step.sourceIds.length).toBeGreaterThan(0);
      for (const id of step.sourceIds) expect(guidedCaseSource(id)).toBeDefined();
    }
    for (const source of MAGAININ_PEXIGANAN_CASE.sources) {
      const u = new URL(source.url);
      expect(u.protocol).toBe("https:");
      expect(["pubchem.ncbi.nlm.nih.gov", "pubmed.ncbi.nlm.nih.gov", "clinicaltrials.gov"]).toContain(u.hostname);
      expect(source.limitation.length).toBeGreaterThan(40);
    }
    const urls = MAGAININ_PEXIGANAN_CASE.sources.map(item => item.url);
    expect(urls).toContain("https://pubmed.ncbi.nlm.nih.gov/12719236/");
    expect(urls).toContain("https://clinicaltrials.gov/study/NCT01594762");
    expect(urls).toContain("https://pubchem.ncbi.nlm.nih.gov/compound/16130189");
    expect(urls).toContain("https://pubchem.ncbi.nlm.nih.gov/compound/16132253");
  });

  it("generates a source workpaper with methodological limits and no sales", () => {
    const txt = guidedCaseMarkdown();
    expect(txt).toContain("magainin");
    expect(txt).toContain("https://pubmed.ncbi.nlm.nih.gov/12719236/");
    expect(txt).toContain("https://clinicaltrials.gov/study/NCT01594762");
    expect(txt).toContain("not independently expert-reviewed");
    expect(txt).toContain("not a clinical effectiveness finding");
    expect(txt.toLowerCase()).not.toMatch(/buy now|add to cart|affiliate|approved to buy/);
  });
});

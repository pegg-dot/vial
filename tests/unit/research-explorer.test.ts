import { describe, expect, it } from "vitest";
import {
  compareExplorerHref, RESEARCH_SUBJECTS, RESEARCH_THEMES,
  registryDiscoveryUrl, researchSubjectBySlug, researchThemeById, verifiedPubmedSearchUrl,
} from "@/lib/research-explorer";

describe("research-only peptide discovery corpus", () => {
  it("ships 16 distinct, categorized and noncommercial research subjects", () => {
    expect(RESEARCH_SUBJECTS).toHaveLength(16);
    expect(RESEARCH_THEMES).toHaveLength(4);
    expect(new Set(RESEARCH_SUBJECTS.map(s => s.slug)).size).toBe(16);
    for (const theme of RESEARCH_THEMES) {
      expect(RESEARCH_SUBJECTS.filter(s => s.theme === theme.id)).toHaveLength(4);
    }
    for (const subject of RESEARCH_SUBJECTS) {
      expect(researchThemeById(subject.theme)).toBeTruthy();
      expect(subject.studyQuestion.length).toBeGreaterThan(25);
      expect(subject.identityCaveat.length).toBeGreaterThan(35);
      expect(subject.scientistAngle.length).toBeGreaterThan(35);
      expect(subject.analystAngle.length).toBeGreaterThan(35);
      expect(subject.nextReview.length).toBeGreaterThan(40);
      expect(subject.referenceLabel).toContain("PubChem");
      const reference = new URL(subject.referenceUrl);
      expect(reference.protocol).toBe("https:");
      expect(reference.hostname).toBe("pubchem.ncbi.nlm.nih.gov");
      expect(Object.keys(subject).join(",")).not.toMatch(/price|vendor|buy|checkout|merchant|purchase|dosage|rating|efficacyScore/i);
      expect(researchSubjectBySlug(subject.slug)).toEqual(subject);
      expect(new URL(verifiedPubmedSearchUrl(subject)).hostname).toBe("pubmed.ncbi.nlm.nih.gov");
      expect(new URL(registryDiscoveryUrl(subject)).hostname).toBe("clinicaltrials.gov");
    }
  });

  it("keeps scientific identity distinctions rather than merging name-search variants", () => {
    const tirzepatide = researchSubjectBySlug("tirzepatide")!;
    expect(tirzepatide.referenceUrl).toBe("https://pubchem.ncbi.nlm.nih.gov/compound/156588324");
    expect(tirzepatide.identityCaveat).toContain("several structures or forms");

    const retatrutide = researchSubjectBySlug("retatrutide")!;
    expect(retatrutide.referenceLabel).toContain("no CID");
    expect(retatrutide.referenceUrl).toContain("/substance/528343961");

    expect(researchSubjectBySlug("cagrilintide")?.identityCaveat).toContain("CagriSema");
    expect(researchSubjectBySlug("arginine-vasopressin")?.referenceLabel).toContain("argipressin");
    expect(researchSubjectBySlug("nisin-a")?.identityCaveat).toContain("variants");
  });

  it("only associates checked example trials, not a generic molecule-name search hit", () => {
    const known = RESEARCH_SUBJECTS.filter(s => Boolean(s.sampleTrial));
    expect(known.map(x => x.sampleTrial)).toEqual([
      "NCT03548935", "NCT02759107", "NCT05929079", "NCT05804162", "NCT01594762",
    ]);
    expect(RESEARCH_SUBJECTS.filter(s => !s.sampleTrial)).toHaveLength(11);
  });

  it("keeps URL routing constrained and comparison safe to share", () => {
    for (const invalid of ["__proto__", "constructor", "toString", "unknown-peptide", "bpc-157", "", "retatrutide/private"]) {
      expect(researchSubjectBySlug(invalid)).toBeUndefined();
    }
    expect(compareExplorerHref(["semaglutide", "tirzepatide", "semaglutide", "retatrutide", "ziconotide"], "researcher"))
      .toBe("/intelligence/compare?subjects=semaglutide%2Ctirzepatide%2Cretatrutide&audience=researcher");
    expect(compareExplorerHref(["constructor", "nisin-a", "unknown-peptide", "ll-37"], "analyst"))
      .toBe("/intelligence/compare?subjects=nisin-a%2Cll-37&audience=analyst");
  });
});

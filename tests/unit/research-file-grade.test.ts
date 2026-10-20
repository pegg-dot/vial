import { describe, expect, it } from "vitest";
import { RESEARCH_SUBJECTS, researchSubjectBySlug } from "@/lib/research-explorer";
import {
  FILE_GRADE_LIMITS, FILE_GRADE_METHOD_VERSION,
  gradeResearchFile, sortSubjectsByFileCoverage,
} from "@/lib/research-file-grade";

describe("provisional research SOURCE-FILE grades, not peptide scores", () => {
  it("scores only three independently anchored types and abstains for ambiguous identities", () => {
    const files = RESEARCH_SUBJECTS.map(subject => ({ slug: subject.slug, file: gradeResearchFile(subject) }));
    expect(files).toHaveLength(16);
    expect(files.filter(x => x.file.letter === "A").map(x => x.slug)).toEqual(["pexiganan"]);
    expect(files.filter(x => x.file.letter === "B").map(x => x.slug)).toEqual([
      "semaglutide", "tirzepatide", "cagrilintide",
    ]);
    expect(files.filter(x => x.file.letter === "C")).toHaveLength(10);
    expect(files.filter(x => x.file.letter === null).map(x => x.slug)).toEqual(["retatrutide", "nisin-a"]);
    for (const { slug, file } of files) {
      expect(file.totalChecks, slug).toBe(3);
      expect(file.checks.map(check => check.key)).toEqual(["molecule", "selected-trial", "original-experiment"]);
      expect(file.linkedCount).toBe(file.checks.filter(check => check.state === "linked").length);
      expect(file.reviewQuestion.length).toBeGreaterThan(40);
      expect(file.methodVersion).toBe(FILE_GRADE_METHOD_VERSION);
      for (const check of file.checks) {
        expect(check.finding.length).toBeGreaterThan(35);
        expect(check.limitation.length).toBeGreaterThan(30);
        if (check.href) {
          const u = new URL(check.href);
          expect(u.protocol).toBe("https:");
          expect(["pubchem.ncbi.nlm.nih.gov", "clinicaltrials.gov", "pubmed.ncbi.nlm.nih.gov"]).toContain(u.hostname);
          expect(check.linkLabel?.length).toBeGreaterThan(10);
        } else expect(check.linkLabel).toBeNull();
      }
    }
  });

  it("preserves intervention and original-publication boundaries instead of treating search hits as vetted", () => {
    const pexiganan = gradeResearchFile(researchSubjectBySlug("pexiganan")!);
    expect(pexiganan.letter).toBe("A");
    expect(pexiganan.checks[1].href).toBe("https://clinicaltrials.gov/study/NCT01594762");
    expect(pexiganan.checks[2].href).toBe("https://pubmed.ncbi.nlm.nih.gov/12719236/");

    const magainin = gradeResearchFile(researchSubjectBySlug("magainin-2")!);
    expect(magainin.letter).toBe("C");
    expect(magainin.checks[2].state).toBe("not-reviewed");
    expect(magainin.checks[2].href).toBeNull();

    const cagrilintide = gradeResearchFile(researchSubjectBySlug("cagrilintide")!);
    expect(cagrilintide.letter).toBe("B");
    expect(cagrilintide.checks[1].state).toBe("linked");
    expect(cagrilintide.checks[2].state).toBe("not-reviewed");

    const retatrutide = gradeResearchFile(researchSubjectBySlug("retatrutide")!);
    expect(retatrutide.letter).toBeNull();
    expect(retatrutide.checks[0].state).toBe("qualified");
    expect(retatrutide.checks[1].state).toBe("linked");
    expect(retatrutide.checks[0].href).toContain("/substance/");
  });

  it("does not infer zero clinical studies from an unreviewed selected-trial field", () => {
    const oxytocin = gradeResearchFile(researchSubjectBySlug("oxytocin")!);
    expect(oxytocin.checks[1].state).toBe("not-reviewed");
    expect(oxytocin.checks[1].finding).toMatch(/No intervention-matched trial has been individually pinned/);
    expect(oxytocin.checks[1].limitation).toContain("NOT the same as no trial exists");
    expect(FILE_GRADE_LIMITS).toContain("not scientific evidence certainty");
    expect(FILE_GRADE_LIMITS).toContain("suitability for purchase");
    const allSerialized = JSON.stringify(RESEARCH_SUBJECTS.map(gradeResearchFile)).toLowerCase();
    expect(allSerialized).not.toMatch(/affiliate|checkout|buy now|seller|vendor score|recommend to buy/);
  });

  it("only reorders files by already documented source layers and retains ungraded at the bottom", () => {
    const original = RESEARCH_SUBJECTS.map(s => s.slug);
    const sorted = sortSubjectsByFileCoverage(RESEARCH_SUBJECTS);
    expect(RESEARCH_SUBJECTS.map(s => s.slug)).toEqual(original);
    expect(new Set(sorted.map(s => s.slug)).size).toBe(16);
    expect(sorted[0]?.slug).toBe("pexiganan");
    expect(sorted.slice(-2).map(s => s.slug)).toEqual(["retatrutide", "nisin-a"]);
    expect(sorted.filter(s => gradeResearchFile(s).letter === "B")).toHaveLength(3);
  });
});

import { describe, expect, it } from "vitest";
import { buildDeskBrief, coverageNote, deskClaims, deskSources, deskSponsors, DESK_TOPICS, deskTopicById, questionCoverage } from "@/lib/peptide-research-desk";
import { PEXIGANAN_CLAIMS, PEXIGANAN_SOURCES } from "@/lib/pexiganan-evidence-network";

describe("question-specific, source-bound research desk", () => {
  it("only exposes four manually scoped question types", () => {
    expect(DESK_TOPICS.map(x => x.id)).toEqual(["identity", "clinical-trials", "publication-matching", "organizations"]);
    expect(deskTopicById("constructor")).toBeUndefined();
    for (const topic of DESK_TOPICS) {
      expect(topic.question.length).toBeGreaterThan(25);
      expect(topic.focus.researcher.length).toBeGreaterThan(45);
      expect(topic.focus.analyst.length).toBeGreaterThan(45);
      expect(deskClaims(topic.id).length).toBeGreaterThan(0);
      expect(deskSources(topic.id).length).toBeGreaterThan(0);
      for (const claim of deskClaims(topic.id)) {
        expect(PEXIGANAN_CLAIMS).toContain(claim);
      }
      for (const source of deskSources(topic.id)) {
        expect(PEXIGANAN_SOURCES).toContain(source);
        expect(new URL(source.url).protocol).toBe("https:");
        expect(["pubmed.ncbi.nlm.nih.gov","clinicaltrials.gov","pubchem.ncbi.nlm.nih.gov"]).toContain(new URL(source.url).hostname);
      }
    }
  });

  it("keeps literature ambiguities and the exact original identifiers", () => {
    const brief = buildDeskBrief({ topicId: "publication-matching", audience: "researcher" });
    expect(brief).toContain("PMID 18990064");
    expect(brief).toContain("PMID 36781451");
    expect(brief).toContain("NCT00563394");
    expect(brief).toContain("review");
    expect(brief).toContain("not proof of NCT-to-publication equivalence");
    expect(brief).toContain("NOT a systematic review");
    expect(brief).not.toMatch(/(?:98%\s*purity|approved synthesis|safely manufactured|guaranteed)/i);
  });

  it("preserves the user question but does not pretend a model answered", () => {
    const brief = buildDeskBrief({
      topicId: "identity", audience: "analyst",
      question: "What evidence supports a lineage relationship?",
    });
    expect(brief).toContain("Research question: What evidence supports a lineage relationship?");
    expect(brief).toContain("No model analysis was executed");
    expect(brief).toContain("Magainin 2 is a separate compound");
    expect(brief).toContain("CID 16132253");
    expect(brief).toContain("CID 16130189");
  });

  it("has no arbitrary topic escape or unsupported clinical outcome inference", () => {
    expect(() => buildDeskBrief({ topicId: "unknown" as never, audience: "researcher" })).toThrow();
    const clinical = buildDeskBrief({ topicId: "clinical-trials", audience: "researcher" });
    expect(clinical).toContain("No outcome statistic has been adjudicated for clinical efficacy");
    expect(clinical).toContain("NCT01594762");
    expect(clinical).toContain("NCT01590758");
  });
});

describe("question coverage is stated, never simulated", () => {
  it("treats empty text and the pinned question as fixed evidence", () => {
    expect(questionCoverage("identity", "").state).toBe("pinned");
    expect(questionCoverage("identity", DESK_TOPICS[0].question).state).toBe("pinned");
  });

  it("carries custom wording through without claiming retrieval", () => {
    const coverage = questionCoverage("clinical-trials", "Which sponsors ran these trials?");
    expect(coverage.state).toBe("own-wording");
    expect(coverageNote(coverage)).toContain("did not search");
  });

  it("flags a different compound as not covered, but not when pexiganan is also named", () => {
    const other = questionCoverage("identity", "What do the semaglutide trials show?");
    expect(other).toEqual({ state: "other-compound", names: ["Semaglutide"] });
    expect(coverageNote(other)).toContain("do not answer it");
    expect(questionCoverage("identity", "Compare pexiganan with semaglutide").state).toBe("own-wording");
    // word boundary: a longer word must not trigger a compound
    expect(questionCoverage("identity", "is semaglutides plural a typo").state).toBe("own-wording");
  });

  it("writes the coverage verdict and the sponsor attributions into the brief", () => {
    const brief = buildDeskBrief({ topicId: "organizations", audience: "analyst", question: "Who funded semaglutide?" });
    expect(brief).toContain("Question coverage: Your wording names Semaglutide");
    expect(brief).toContain("Dipexium Pharmaceuticals, Inc.");
    expect(brief).toContain("not current ownership");
    expect(buildDeskBrief({ topicId: "clinical-trials", audience: "analyst" })).not.toContain("Dipexium Pharmaceuticals");
  });

  it("gives Sponsor history content the clinical program does not have", () => {
    expect(deskSponsors("organizations").length).toBe(2);
    expect(deskSponsors("clinical-trials")).toEqual([]);
  });
});

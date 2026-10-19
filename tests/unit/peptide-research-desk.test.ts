import { describe, expect, it } from "vitest";
import { buildDeskBrief, deskClaims, deskSources, DESK_TOPICS, deskTopicById } from "@/lib/peptide-research-desk";
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

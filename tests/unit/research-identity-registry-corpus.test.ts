import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  classifyTrialAssociation,
  getResearchIdentityCandidate,
} from "@/server/intelligence/topic-identity-candidates";

type CorpusCase = {
  topic: string;
  nctId: string;
  expected: "intervention-recorded" | "named-in-title" | "search-hit-only";
  sourceUrl: string;
  record: unknown;
};

const corpus = JSON.parse(readFileSync(new URL(
  "../fixtures/clinical-trial-association-corpus.json",
  import.meta.url,
), "utf8")) as {
  schemaVersion: number;
  origin: string;
  capturedAt: string;
  reviewStatus: string;
  scope: string;
  cases: CorpusCase[];
};

describe("source-sampled clinical registry field match benchmark", () => {
  it("pins a diverse, provisional sample without presenting it as reviewed scientific truth", () => {
    expect(corpus.schemaVersion).toBe(1);
    expect(corpus.origin).toContain("ClinicalTrials.gov");
    expect(corpus.reviewStatus).toContain("independent domain-review NOT complete");
    expect(corpus.scope).toContain("not clinical efficacy");
    expect(Number.isNaN(Date.parse(corpus.capturedAt))).toBe(false);
    expect(corpus.cases).toHaveLength(45);
    const counts = new Map<string, number>();
    const seen = new Set<string>();
    for (const row of corpus.cases) {
      expect(getResearchIdentityCandidate(row.topic)).not.toBeNull();
      expect(row.nctId).toMatch(/^NCT\d{8}$/);
      expect(row.sourceUrl).toBe("https://clinicaltrials.gov/study/" + row.nctId);
      const key = row.topic + ":" + row.nctId;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      counts.set(row.expected, (counts.get(row.expected) ?? 0) + 1);
      expect(row.record).toEqual(expect.objectContaining({
        protocolSection: expect.objectContaining({
          identificationModule: expect.objectContaining({ nctId: row.nctId }),
        }),
      }));
    }
    expect(counts.get("intervention-recorded")).toBe(29);
    expect(counts.get("named-in-title")).toBe(5);
    expect(counts.get("search-hit-only")).toBe(11);
    // Multi-asset programs legitimately appear in more than one topic: do
    // not globally deduplicate by NCT ID before associating programs.
    expect(corpus.cases.filter(x => x.nctId === "NCT07165028")).toHaveLength(2);
  });

  it("reproduces first-pass field labels from minimal official snapshots", () => {
    const disagreements: Array<string> = [];
    for (const row of corpus.cases) {
      const identity = getResearchIdentityCandidate(row.topic)!;
      const actual = classifyTrialAssociation(row.record, identity);
      if (actual !== row.expected) {
        disagreements.push(row.topic + " " + row.nctId + ": " + row.expected + " != " + actual);
      }
    }
    expect(disagreements).toEqual([]);
  });

  it("does not conflate combination-product text or incidental mentions with an explicit ingredient intervention", () => {
    function get(id: string, topic: string) {
      const found = corpus.cases.find(x => x.nctId === id && x.topic === topic);
      expect(found).toBeDefined();
      return found!;
    }
    // CagriSema is a combination product: a combination label alone is not
    // automatically proof of direct cagrilintide field identity.
    expect(get("NCT07564414", "cagrilintide").expected).toBe("search-hit-only");
    // A different Novo development code can appear in keyword search
    // results: do not silently resolve it to cagrilintide.
    expect(get("NCT03617081", "cagrilintide").expected).toBe("search-hit-only");
    // Use of tirzepatide in the population is different from the study's
    // registered intervention, and title mentions should say so.
    expect(get("NCT07398222", "tirzepatide").expected).toBe("named-in-title");
    // The same registered trial can contain both Retatrutide and Tirzepatide
    // as named interventions, without any claim of efficacy for either.
    expect(get("NCT07165028", "retatrutide").expected).toBe("intervention-recorded");
    expect(get("NCT07165028", "tirzepatide").expected).toBe("intervention-recorded");
  });
});

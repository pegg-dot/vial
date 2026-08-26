import { describe, expect, it } from "vitest";
import { enforcementEmptyState } from "@/lib/enforcement-copy";

describe("enforcementEmptyState", () => {
  it("says nothing about emptiness while there are results", () => {
    expect(enforcementEmptyState({ corpusTotal: 200, filteredTotal: 50 })).toEqual({ kind: "results" });
  });

  // THE DEFECT. The default filter is vendor-matched, so a corpus of unmatched openFDA recalls
  // produced an empty first page — and the page told the reader nothing had been ingested.
  it("blames the filter, never the corpus, when records exist but none matched", () => {
    const state = enforcementEmptyState({ corpusTotal: 200, filteredTotal: 0 });
    expect(state.kind).toBe("filter-empty");
    expect(state).toHaveProperty("offerAllFilter", true);
    expect("message" in state && state.message).not.toContain("ingested");
  });

  it("claims an empty corpus only when the corpus really is empty", () => {
    const state = enforcementEmptyState({ corpusTotal: 0, filteredTotal: 0 });
    expect(state.kind).toBe("corpus-empty");
    expect("message" in state && state.message).toContain("No enforcement records ingested yet.");
  });

  it("does not blame a filter when nothing is being hidden", () => {
    const state = enforcementEmptyState({ corpusTotal: 0, filteredTotal: 0 });
    expect("message" in state && state.message).not.toContain("filter");
  });

  it("treats a negative or unknown corpus count as empty rather than inventing a filter excuse", () => {
    expect(enforcementEmptyState({ corpusTotal: -1, filteredTotal: 0 }).kind).toBe("corpus-empty");
  });
});

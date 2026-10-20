import { describe, expect, it } from "vitest";
import { DEFAULT_EXPLORER_STATE, parseExplorerState, serializeExplorerState } from "@/lib/research-explorer-state";

describe("research explorer URL state", () => {
  it("round-trips every control", () => {
    const state = { query: "oxy", theme: "metabolic", audience: "analyst", source: "selected-trial", grade: "B", sort: "source-coverage", compare: ["oxytocin", "ll-37"] } as const;
    const text = serializeExplorerState({ ...state, compare: [...state.compare] });
    const back = parseExplorerState(Object.fromEntries(new URLSearchParams(text)));
    expect(back).toEqual({ ...state, compare: [...state.compare] });
  });

  it("writes nothing for the default state, so the unfiltered URL stays clean", () => {
    expect(serializeExplorerState(DEFAULT_EXPLORER_STATE)).toBe("");
  });

  it("falls back to defaults for unknown or hand-edited values", () => {
    expect(parseExplorerState({ theme: "<script>", view: "x", src: "nope", grade: "Z", sort: "price" })).toEqual(DEFAULT_EXPLORER_STATE);
  });

  it("keeps only known, distinct compare slugs and at most three", () => {
    const s = parseExplorerState({ compare: "oxytocin,oxytocin,not-real,ll-37,octreotide,lanreotide" });
    expect(s.compare).toEqual(["oxytocin", "ll-37", "octreotide"]);
  });

  it("takes the first value when a param repeats and caps the query length", () => {
    expect(parseExplorerState({ sort: ["source-coverage", "editorial"] }).sort).toBe("source-coverage");
    expect(parseExplorerState({ q: "a".repeat(500) }).query).toHaveLength(80);
  });
});

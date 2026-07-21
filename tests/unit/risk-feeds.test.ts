import { describe, expect, it } from "vitest";
import { filterRiskSignals } from "@/server/api-access/feeds";

const s = (signalType: string, score: number) => ({ signalType, score, id: `${signalType}-${score}` });

describe("risk-signal feed filtering", () => {
  it("filters by signal type", () => {
    const out = filterRiskSignals([s("price-dispersion", 80), s("thin-availability", 90)], { types: ["price-dispersion"] });
    expect(out.map((x) => x.signalType)).toEqual(["price-dispersion"]);
  });
  it("filters by minimum score and ranks by score descending", () => {
    const out = filterRiskSignals([s("a", 50), s("b", 90), s("c", 70)], { minScore: 60 });
    expect(out.map((x) => x.score)).toEqual([90, 70]);
  });
  it("caps to the requested limit", () => {
    expect(filterRiskSignals([s("a", 90), s("b", 80), s("c", 70)], { limit: 2 })).toHaveLength(2);
  });
  it("returns all ranked when no filters are given", () => {
    expect(filterRiskSignals([s("a", 30), s("b", 60)]).map((x) => x.score)).toEqual([60, 30]);
  });
});

import { describe, expect, it } from "vitest";
import { attentionState, COLLECTOR_COVERED_BY } from "@/lib/collector-attention";

const runs = (lastOk: boolean | null) => [{ collector: "lab-janoshik-capture", lastOk }];

describe("attentionState", () => {
  it("a disabled target reads as self-healing, not as an emergency", () => {
    const s = attentionState({ collector: "catalog-shopify", enabled: false, consecutiveFailures: 3 }, []);
    expect(s.label).toBe("disabled — retried weekly");
    expect(s.tone).toBe("muted");
  });

  it("a covered failure is amber ONLY while the covering collector is green", () => {
    const s = attentionState({ collector: "lab-janoshik", enabled: true, consecutiveFailures: 2 }, runs(true));
    expect(s.tone).toBe("amber");
    expect(s.label).toContain("known blocker");
    expect(s.label).toContain("lab-janoshik-capture");
  });

  it("the soft label is revoked when the cover itself fails — that is a real outage", () => {
    expect(attentionState({ collector: "lab-janoshik", enabled: true, consecutiveFailures: 2 }, runs(false)).tone).toBe("red");
    expect(attentionState({ collector: "lab-janoshik", enabled: true, consecutiveFailures: 2 }, runs(null)).tone).toBe("red");
    expect(attentionState({ collector: "lab-janoshik", enabled: true, consecutiveFailures: 2 }, []).tone).toBe("red");
  });

  it("an uncovered failing collector stays plainly red", () => {
    const s = attentionState({ collector: "domain-age", enabled: true, consecutiveFailures: 2 }, runs(true));
    expect(s.tone).toBe("red");
    expect(s.label).toBe("failing (2)");
  });

  it("every coverage mapping points at a different collector", () => {
    for (const [k, v] of Object.entries(COLLECTOR_COVERED_BY)) {
      expect(v, `${k} covered by itself`).not.toBe(k);
      expect(v).toBeTruthy();
    }
  });
});

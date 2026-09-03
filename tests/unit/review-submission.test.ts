import { describe, expect, it } from "vitest";
import { parseReviewSubmission } from "@/lib/review-submission";

function fd(entries: [string, string][]) {
  const d = new Map<string, string[]>();
  for (const [k, v] of entries) d.set(k, [...(d.get(k) ?? []), v]);
  return {
    get: (n: string) => d.get(n)?.[0] ?? null,
    getAll: (n: string) => d.get(n) ?? [],
  };
}

describe("parseReviewSubmission", () => {
  it("a per-card approve acts on that card only, even with other rows checked", () => {
    const s = parseReviewSubmission(fd([["approveOne", "c1"], ["selected", "c2"], ["selected", "c3"]]));
    expect(s).toEqual({ mode: "single", claimId: "c1", decision: "approve" });
  });

  it("a per-card reject likewise", () => {
    expect(parseReviewSubmission(fd([["rejectOne", "c9"], ["selected", "c1"]]))).toEqual({ mode: "single", claimId: "c9", decision: "reject" });
  });

  it("bulk approve gathers the checked set, deduplicated", () => {
    const s = parseReviewSubmission(fd([["bulk", "approve"], ["selected", "c1"], ["selected", "c2"], ["selected", "c1"]]));
    expect(s).toEqual({ mode: "bulk", claimIds: ["c1", "c2"], decision: "approve" });
  });

  it("bulk with nothing checked is a refusal, not an empty publish", () => {
    const s = parseReviewSubmission(fd([["bulk", "approve"]]));
    expect(s.mode).toBe("error");
  });

  it("the original single-form fields still parse", () => {
    expect(parseReviewSubmission(fd([["claimId", "c4"], ["decision", "reject"]]))).toEqual({ mode: "single", claimId: "c4", decision: "reject" });
  });

  it("garbage is an error, never a decision", () => {
    expect(parseReviewSubmission(fd([["bulk", "detonate"], ["selected", "c1"]])).mode).toBe("error");
    expect(parseReviewSubmission(fd([])).mode).toBe("error");
  });
});

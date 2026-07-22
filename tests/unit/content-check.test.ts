import { describe, expect, it } from "vitest";
import { checkContent } from "@/server/verify/content-check";

describe("content / dose check", () => {
  it("passes a full-dose vial (measured ≈ labeled)", () => {
    const r = checkContent("TB-500 10mg", "11.41 mg");
    expect(r.verdict).toBe("full");
    expect(r.labeledMg).toBe(10);
    expect(r.measuredMg).toBe(11.41);
  });

  it("flags an underdosed vial", () => {
    const r = checkContent("Semaglutide 10mg", "7.20 mg");
    expect(r.verdict).toBe("underdosed");
    expect(r.note).toMatch(/72%|only/i);
  });

  it("marks a generous overfill (not a problem)", () => {
    expect(checkContent("BPC-157 5mg", "6.90 mg").verdict).toBe("overfilled");
  });

  it("takes the first mg of a dual-vial report", () => {
    expect(checkContent("Retatrutide 20mg", "22.46 mg; 22.39 mg").measuredMg).toBe(22.46);
  });

  it("returns null for blends and IU-only / content-less reports", () => {
    expect(checkContent("Klow80(TB-500 10mg+BPC-157 10mg)", "BPC-157 5.46 mg; TB-500 5.47 mg").verdict).toBeNull();
    expect(checkContent("HCG 5000IU", "8692 IU").verdict).toBeNull();
    expect(checkContent("BPC-157", null).verdict).toBeNull();
    expect(checkContent("BPC-157", "See report").verdict).toBeNull();
  });
});

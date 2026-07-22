import { describe, expect, it } from "vitest";
import { severityForAction, resolveActionToVendor, verdictFromSeverities } from "@/server/regulatory/actions";

const vendors = [
  { slug: "paradigm-peptides", name: "Paradigm Peptides", domains: ["paradigmpeptides.com"] },
  { slug: "swiss-chems", name: "Swiss Chems", domains: ["swisschems.is"] },
  { slug: "core-peptides", name: "Core Peptides", domains: ["corepeptides.com"] },
];

describe("severityForAction — never overstates", () => {
  it("only proven criminal/civil outcomes are severe", () => {
    expect(severityForAction({ actionType: "doj_action", outcome: "guilty_plea" })).toBe("severe");
    expect(severityForAction({ actionType: "doj_action", outcome: "convicted" })).toBe("severe");
    expect(severityForAction({ actionType: "ftc_action", outcome: "injunction" })).toBe("severe");
  });
  it("a mere charge is caution, not severe", () => {
    expect(severityForAction({ actionType: "doj_action", outcome: "charged" })).toBe("caution");
    expect(severityForAction({ actionType: "doj_action", outcome: "indicted" })).toBe("caution");
  });
  it("regulatory warnings / import alerts / recalls are caution", () => {
    expect(severityForAction({ actionType: "warning_letter" })).toBe("caution");
    expect(severityForAction({ actionType: "import_alert" })).toBe("caution");
    expect(severityForAction({ actionType: "recall" })).toBe("caution");
  });
  it("a market-wide advisory is informational", () => {
    expect(severityForAction({ actionType: "advisory" })).toBe("informational");
  });
});

describe("resolveActionToVendor — strict, to avoid false attribution", () => {
  it("matches on an explicit domain in the subject", () => {
    expect(resolveActionToVendor("Operator of paradigmpeptides.com", vendors)).toEqual({ vendorSlug: "paradigm-peptides", confidence: "high" });
  });
  it("matches an exact normalized name, ignoring legal suffixes", () => {
    expect(resolveActionToVendor("Paradigm Peptides LLC", vendors)).toEqual({ vendorSlug: "paradigm-peptides", confidence: "high" });
    expect(resolveActionToVendor("SWISS CHEMS", vendors)).toEqual({ vendorSlug: "swiss-chems", confidence: "high" });
  });
  it("does NOT attribute on a partial / fuzzy / different name — real defamation risk", () => {
    expect(resolveActionToVendor("Paradigm Labs Inc.", vendors)).toEqual({ vendorSlug: null, confidence: "none" });
    expect(resolveActionToVendor("Core Nutritionals", vendors)).toEqual({ vendorSlug: null, confidence: "none" });
    expect(resolveActionToVendor("Some Unrelated Company", vendors)).toEqual({ vendorSlug: null, confidence: "none" });
    expect(resolveActionToVendor("", vendors)).toEqual({ vendorSlug: null, confidence: "none" });
  });
});

describe("verdictFromSeverities", () => {
  it("severe → avoid, caution → caution, else null", () => {
    expect(verdictFromSeverities(["caution", "severe"])).toBe("avoid");
    expect(verdictFromSeverities(["caution", "informational"])).toBe("caution");
    expect(verdictFromSeverities(["informational"])).toBe(null);
    expect(verdictFromSeverities([])).toBe(null);
  });
});

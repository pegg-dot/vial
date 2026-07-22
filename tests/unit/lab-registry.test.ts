import { describe, expect, it } from "vitest";
import { getLabProfile, canonicalizeLabName, labCountsAsIndependent, LAB_REGISTRY } from "@/server/labs/registry";

describe("lab registry", () => {
  it("resolves aliases and casing to one canonical profile", () => {
    expect(getLabProfile("Janoshik")?.slug).toBe("janoshik-analytical");
    expect(getLabProfile("janoshik analytical")?.slug).toBe("janoshik-analytical");
    expect(getLabProfile("JANOSHIK  S.R.O.")?.slug).toBe("janoshik-analytical");
    expect(getLabProfile("MZ Biolabs")?.slug).toBe("mz-biolabs");
    expect(getLabProfile("mzbiolabs")?.slug).toBe("mz-biolabs");
  });

  it("collapses split lab names to one display name", () => {
    expect(canonicalizeLabName("Janoshik")).toBe("Janoshik Analytical");
    expect(canonicalizeLabName("Janoshik Analytical")).toBe("Janoshik Analytical");
    // An unvetted lab passes through unchanged rather than being dropped.
    expect(canonicalizeLabName("Some New Lab")).toBe("Some New Lab");
  });

  it("only counts CONFIRMED independent labs as independent corroboration", () => {
    expect(labCountsAsIndependent("Janoshik Analytical")).toBe(true);
    expect(labCountsAsIndependent("MZ Biolabs")).toBe(true);
    expect(labCountsAsIndependent("Vanguard Laboratory")).toBe(true);
    expect(labCountsAsIndependent("BTLabs")).toBe(true);
    // Contested / unverified independence → NOT counted.
    expect(labCountsAsIndependent("Kovera Labs")).toBe(false);
    expect(labCountsAsIndependent("SR Bio Labs")).toBe(false);
    // Existence unconfirmed → NOT counted.
    expect(labCountsAsIndependent("Horizon Analytical")).toBe(false);
    expect(labCountsAsIndependent("SteriGenix")).toBe(false);
    // A lab we've never vetted is conservatively NOT independent.
    expect(labCountsAsIndependent("Totally Unknown Lab")).toBe(false);
  });

  it("never asserts a bare accreditation — every claim carries a verification status", () => {
    for (const lab of LAB_REGISTRY) {
      expect(lab.accreditation.status).toBeDefined();
      // If iso17025 is claimed true, it must NOT be an unsourced assertion.
      if (lab.accreditation.iso17025 === true) {
        expect(["verified-against-accreditor", "reported-by-third-party", "claimed-by-lab"]).toContain(lab.accreditation.status);
        expect(lab.accreditation.note.length).toBeGreaterThan(20);
      }
      expect(lab.sourceUrls.length).toBeGreaterThan(0);
    }
  });

  it("flags the Vanguard scope mismatch — accredited, but not for peptides", () => {
    const v = getLabProfile("Vanguard Laboratory")!;
    expect(v.accreditation.iso17025).toBe(true);
    expect(v.accreditation.status).toBe("verified-against-accreditor");
    expect(v.accreditation.scopeCoversPeptides).toBe(false);
  });

  it("marks unconfirmed labs as such so nothing is over-claimed", () => {
    expect(getLabProfile("Horizon Analytical")?.exists).toBe("unconfirmed");
    expect(getLabProfile("SteriGenix")?.exists).toBe("unconfirmed");
    expect(getLabProfile("SteriGenix")?.independence).toBe("unverified");
  });
});

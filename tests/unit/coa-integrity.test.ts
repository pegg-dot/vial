import { describe, expect, it } from "vitest";
import { detectVendorCoaFlags, looksLikeLotNumber, type PostedCoa } from "@/server/verify/coa-integrity";

const kinds = (coas: PostedCoa[], name = "Test Vendor", year = 2026) => detectVendorCoaFlags(name, coas, year).map((f) => f.kind);

describe("COA integrity detector", () => {
  it("flags a lot number reused across many products", () => {
    const coas: PostedCoa[] = ["bpc-157", "cjc-1295", "ghk-cu", "mots-c"].map((c) => ({ vendorSlug: "v", vendorName: "V", compound: c, lot: "SAME-LOT", lab: "Third Party", testedAt: "2026" }));
    expect(kinds(coas)).toContain("reused-lot");
  });

  it("flags self-issued certificates", () => {
    const coas: PostedCoa[] = ["bpc-157", "tb-500"].map((c) => ({ vendorSlug: "cernum", vendorName: "Cernum Biosciences", compound: c, lot: `L-${c}`, lab: "Cernum Biosciences in-house", testedAt: "2026" }));
    expect(kinds(coas, "Cernum Biosciences")).toContain("self-issued");
  });

  it("flags a certificate that pictures a different compound", () => {
    const coas: PostedCoa[] = [{ vendorSlug: "n", vendorName: "N", compound: "bpc-157", lab: "Third Party", testedAt: "2019", coaProduct: "Semax" }];
    expect(kinds(coas)).toContain("mismatched");
  });

  it("flags undated certificates", () => {
    const coas: PostedCoa[] = [{ vendorSlug: "v", vendorName: "V", compound: "bpc-157", lot: "A", lab: "Third Party", testedAt: null }];
    expect(kinds(coas)).toContain("undated");
  });

  it("flags stale (years-old) certificates", () => {
    const coas: PostedCoa[] = [{ vendorSlug: "v", vendorName: "V", compound: "bpc-157", lot: "A", lab: "Third Party", testedAt: "2016" }];
    expect(kinds(coas, "V", 2026)).toContain("stale");
  });

  it("clears a clean vendor with dated, distinct-lot, third-party, matching certs", () => {
    const coas: PostedCoa[] = ["bpc-157", "cjc-1295"].map((c) => ({ vendorSlug: "stl", vendorName: "STL", compound: c, lot: `LOT-${c}`, lab: "MZ Biolabs", testedAt: "2026" }));
    expect(detectVendorCoaFlags("STL", coas, 2026)).toHaveLength(0);
  });
});

// A dry run of this detector over the 281 real certificates raised four reused-lot flags. Three
// were false: the lot was "2026", "2025-10-06" and "3rd June 2026" — dates and a bare year sitting
// in `batch_code`, because that is what the source page offered and nothing checked. Grouping on
// them made unrelated products look like one production run, and the flag says, in the vendor's
// name, that their certificates are "a template, not real per-batch testing".
//
// That is a false statement of fact about a real business, published by the site whose product is
// checking such statements. A value that is ENTIRELY a date is not a lot number. A real lot that
// happens to contain a date still is one.
describe("what counts as a lot number", () => {
  it("rejects a bare year", () => {
    expect(looksLikeLotNumber("2026")).toBe(false);
    expect(looksLikeLotNumber("2025")).toBe(false);
  });

  it("rejects an ISO date", () => {
    expect(looksLikeLotNumber("2025-10-06")).toBe(false);
    expect(looksLikeLotNumber("2026/06/02")).toBe(false);
  });

  it("rejects a written-out date", () => {
    expect(looksLikeLotNumber("3rd June 2026")).toBe(false);
    expect(looksLikeLotNumber("15 APR 2026")).toBe(false);
    expect(looksLikeLotNumber("June 2026")).toBe(false);
  });

  it("rejects nothing at all", () => {
    expect(looksLikeLotNumber(null)).toBe(false);
    expect(looksLikeLotNumber("")).toBe(false);
    expect(looksLikeLotNumber("   ")).toBe(false);
    expect(looksLikeLotNumber("n/a")).toBe(false);
  });

  // These are real lot codes seen in the corpus. Losing them would blind the detector to genuine
  // template certificates, which is the failure in the other direction.
  it("accepts a real lot code, including one that embeds a date", () => {
    expect(looksLikeLotNumber("B002")).toBe(true);
    expect(looksLikeLotNumber("V260602-23-008")).toBe(true);
    expect(looksLikeLotNumber("RT30/2026-04-06A")).toBe(true);
    expect(looksLikeLotNumber("20260624")).toBe(true);
  });
});

describe("reused-lot flagging ignores values that are not lot numbers", () => {
  const coa = (compound: string, lot: string | null) => ({
    vendorSlug: "v", vendorName: "V", compound, lot, lab: "Janoshik Analytical", testedAt: "2026-06-01",
  });

  it("does not accuse a vendor whose lot field holds a date", () => {
    const flags = detectVendorCoaFlags("V", [
      coa("bpc-157", "2025-10-06"), coa("tb-500", "2025-10-06"),
      coa("semax", "2025-10-06"), coa("selank", "2025-10-06"),
    ], 2026);
    expect(flags.some((f) => f.kind === "reused-lot")).toBe(false);
  });

  it("still catches a genuinely reused lot code", () => {
    const flags = detectVendorCoaFlags("V", [
      coa("bpc-157", "B002"), coa("tb-500", "B002"), coa("semax", "B002"),
    ], 2026);
    expect(flags.some((f) => f.kind === "reused-lot")).toBe(true);
  });
});

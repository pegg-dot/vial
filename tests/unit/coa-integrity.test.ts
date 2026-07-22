import { describe, expect, it } from "vitest";
import { detectVendorCoaFlags, type PostedCoa } from "@/server/verify/coa-integrity";

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

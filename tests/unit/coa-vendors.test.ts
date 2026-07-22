import { describe, expect, it } from "vitest";
import { cleanVendorString, looksLikeVendor, deriveCoaVendors } from "@/server/ingest/coa-vendors";

describe("COA vendor derivation", () => {
  it("strips marketing cruft to a clean vendor name", () => {
    expect(cleanVendorString("CertaPeptides | EU VENDOR | 99.3% Average Purity")?.name).toBe("CertaPeptides");
    expect(cleanVendorString("HM Peptide| Wholesale | OEM service")?.name).toBe("HM Peptide");
    expect(cleanVendorString("Crystal Peptides EU (de. / fr. / it.)")?.name).toBe("Crystal Peptides EU");
  });

  it("builds a name and domain from a URL", () => {
    const v = cleanVendorString("https://alphabiopharma.info");
    expect(v?.domain).toBe("alphabiopharma.info");
    expect(v?.name).toBe("Alphabiopharma");
    const w = cleanVendorString("www.certapeptides.com");
    expect(w?.domain).toBe("certapeptides.com");
    expect(w?.slug).toBe("certapeptides");
  });

  it("rejects noise", () => {
    expect(cleanVendorString("Unknown")).toBeNull();
    expect(cleanVendorString("")).toBeNull();
    expect(cleanVendorString("  ")).toBeNull();
  });

  it("only treats domain-or-keyword strings as vendors", () => {
    expect(looksLikeVendor({ name: "Cocer Peptides", slug: "cocer-peptides" })).toBe(true);
    expect(looksLikeVendor({ name: "Alpha", slug: "alpha", domain: "alpha.com" })).toBe(true);
    expect(looksLikeVendor({ name: "Mandy", slug: "mandy" })).toBe(false);
  });

  it("derives a de-duplicated vendor set and ties each COA to a vendor (client preferred)", () => {
    const entries = [
      { testId: "1", client: "CertaPeptides | EU VENDOR", manufacturer: "Alpha BioPharma" },
      { testId: "2", client: "CertaPeptides", manufacturer: "Some Raw Co" },
      { testId: "3", client: "Mandy", manufacturer: "PeptideGurus" },   // client is noise → falls back to maker
    ];
    const { vendors, vendorByTestId } = deriveCoaVendors(entries);
    expect(vendorByTestId.get("1")).toBe("certapeptides");
    expect(vendorByTestId.get("2")).toBe("certapeptides");
    expect(vendorByTestId.get("3")).toBe("peptidegurus");   // fell back to manufacturer
    expect(vendors.map((v) => v.slug).sort()).toEqual(["certapeptides", "peptidegurus"]);
  });
});

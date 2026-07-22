import { describe, expect, it } from "vitest";
import { classifyVendorKind } from "@/server/catalog/vendor-kind";

const retail = new Set(["peptide-pros", "eternal-peptides", "chemyo"]);

describe("classifyVendorKind", () => {
  it("treats a vendor with a shoppable catalog as a storefront", () => {
    expect(classifyVendorKind({ slug: "umbrella-labs", hasListings: true, retailSlugs: retail })).toBe("storefront");
  });

  it("treats a curated retail vendor (no imported catalog) as a storefront", () => {
    // Eternal/Chemyo have real consumer sites and publish COAs — retail, even with no listings yet.
    expect(classifyVendorKind({ slug: "eternal-peptides", hasListings: false, retailSlugs: retail })).toBe("storefront");
    expect(classifyVendorKind({ slug: "chemyo", hasListings: false, retailSlugs: retail })).toBe("storefront");
  });

  it("treats a vendor known only from the lab feed as an upstream manufacturer", () => {
    // A Chinese factory name pulled from a Janoshik "Made By" field — not a place a buyer shops.
    expect(classifyVendorKind({ slug: "zztai-peptide", hasListings: false, retailSlugs: retail })).toBe("manufacturer");
    expect(classifyVendorKind({ slug: "kangpeptide", hasListings: false, retailSlugs: retail })).toBe("manufacturer");
  });

  it("listings always win, even if a slug were somehow not in the retail set", () => {
    expect(classifyVendorKind({ slug: "anything", hasListings: true, retailSlugs: new Set() })).toBe("storefront");
  });
});

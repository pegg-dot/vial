import { describe, expect, it } from "vitest";
import { matchCompound, type CompoundRef } from "@/server/ingest/shopify-import";

// Real product titles from live vendor catalogs that were being mapped to the WRONG molecule —
// and then price-compared against it, putting a nootropic at the top of the "cheapest ipamorelin"
// table at 1/27th the median. Mapping a listing to a compound it does not contain is the most
// dangerous error this product can make.
const COMPOUNDS: CompoundRef[] = [
  { slug: "ipamorelin", name: "Ipamorelin", aliases: ["Ipam", "NNC 26-0161"] },
  { slug: "gonadorelin", name: "Gonadorelin", aliases: ["GnRH", "LHRH", "Factrel"] },
  { slug: "bpc-157", name: "BPC-157", aliases: ["BPC 157"] },
];

describe("compound matching — abbreviation collisions", () => {
  it("does not map Indolepropionamide to Ipamorelin", () => {
    for (const title of [
      "IPAM (Indolepropionamide)",
      "INDOLEPROPIONAMIDE (IPAM) 30ML LIQUID (6MG/ML, 180MG BOTTLE)",
      "INDOLEPROPIONAMIDE (IPAM) POWDER (60 CAPSULES)",
    ]) {
      expect(matchCompound(title, COMPOUNDS), title).not.toBe("ipamorelin");
    }
  });

  it("does not map Triptorelin to Gonadorelin", () => {
    expect(matchCompound("GnRH (Triptorelin) 100 mcg", COMPOUNDS)).not.toBe("gonadorelin");
    expect(matchCompound("GnRH (Triptorelin) - 50 VIALS AT 30 PERCENT OFF", COMPOUNDS)).not.toBe("gonadorelin");
  });

  it("still matches the genuine compounds", () => {
    expect(matchCompound("Ipamorelin 5mg", COMPOUNDS)).toBe("ipamorelin");
    expect(matchCompound("Gonadorelin 2mg vial", COMPOUNDS)).toBe("gonadorelin");
    expect(matchCompound("BPC-157 5mg", COMPOUNDS)).toBe("bpc-157");
  });
});

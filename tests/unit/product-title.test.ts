import { describe, expect, it } from "vitest";
import { displayProductName, displayProductTitle, displaySize, titleStatesSize } from "@/lib/product-title";

describe("display titles — cleanup happens on the way to the screen, never in the data", () => {
  it("stops printing the size twice", () => {
    expect(displayProductTitle("Ipamorelin 2mg", "2mg")).toBe("Ipamorelin 2mg");
    expect(displayProductTitle("Glutathione 600mg", "600mg")).toBe("Glutathione 600mg");
    expect(displaySize("Ipamorelin 2mg", "2mg")).toBe("");
  });

  it("still shows the size when the title does not carry it", () => {
    expect(displayProductTitle("BPC-157", "5mg")).toBe("BPC-157 5mg");
    expect(displaySize("BPC-157", "5mg")).toBe("5mg");
  });

  it("matches a size the title writes with a space", () => {
    expect(titleStatesSize("Retatrutide 10 mg", "10mg")).toBe(true);
  });

  it("does not read '12mg' as already saying '2mg'", () => {
    expect(titleStatesSize("Retatrutide 12mg", "2mg")).toBe(false);
    expect(displayProductTitle("Retatrutide 12mg", "2mg")).toBe("Retatrutide 12mg 2mg");
  });

  it("strips the vendor's sales copy out of the title", () => {
    expect(displayProductName("BPC-157 For Sale")).toBe("BPC-157");
    expect(displayProductName("Tirzepatide (Wholesale ONLY)")).toBe("Tirzepatide");
    expect(displayProductName("Semaglutide - Packs of 5, 10 or 30")).toBe("Semaglutide");
    expect(displayProductName("NAD+ Buy Online")).toBe("NAD+");
  });

  it("never hands back an empty title", () => {
    expect(displayProductName("For Sale")).toBe("For Sale");
    expect(displayProductName("Semaglutide")).toBe("Semaglutide");
  });
});

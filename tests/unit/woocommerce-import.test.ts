import { describe, expect, it } from "vitest";
import { wooPrice, wooQuantity, wooVariationLabels, wooVariationQuantity, type WooProduct } from "@/server/ingest/woocommerce-import";
import { parseTotalMg } from "@/lib/format";

const p = (over: Partial<WooProduct>): WooProduct => ({
  name: "X", permalink: "", type: "simple", is_in_stock: true,
  prices: { price: "0", price_range: null, currency_minor_unit: 2 }, ...over,
});

describe("woocommerce price parsing", () => {
  it("converts minor-unit price strings to dollars", () => {
    expect(wooPrice(p({ prices: { price: "3999", price_range: null, currency_minor_unit: 2 } }))).toBe(39.99);
    expect(wooPrice(p({ prices: { price: "19800", price_range: null, currency_minor_unit: 2 } }))).toBe(198);
  });
  it("prefers the price_range minimum for variable products", () => {
    expect(wooPrice(p({ prices: { price: "9999", price_range: { min_amount: "4500" }, currency_minor_unit: 2 } }))).toBe(45);
  });
  it("returns null when no price is present", () => {
    expect(wooPrice(p({ prices: null }))).toBeNull();
  });
});

describe("woocommerce quantity extraction", () => {
  it("pulls a size label from the product name", () => {
    expect(wooQuantity("BPC-157 – 10mg")).toBe("10mg");
    expect(wooQuantity("Melanotan II 10 mg")).toBe("10mg");
    expect(wooQuantity("GHK-Cu Copper Peptide")).toBe("1 vial");
  });
});

// A WooCommerce product name is almost always the bare compound — "BPC-157", "Ipamorelin" — so
// reading only the name recorded 210 of 537 live listings as the placeholder "1 vial" and excluded
// every one of them from price-per-mg. The size was in the payload all along. Each fixture below is
// the real shape returned by that vendor's /wp-json/wc/store/v1/products.
describe("woocommerce size read from the payload, not the name", () => {
  it("takes the size from a single-option product (purerawz.co, vicipeptides.com)", () => {
    const purerawz = p({
      name: "Survodutide",
      attributes: [{ name: "Strength", has_variations: true, terms: [{ name: "10mg", slug: "10mg" }] }],
      variations: [{ id: 359330792, attributes: [{ name: "Strength", value: "10mg" }] }],
    });
    expect(wooQuantity(purerawz)).toBe("10mg");
    expect(parseTotalMg(wooQuantity(purerawz), purerawz.name)).toBe(10);

    const vici = p({
      name: "Glutathione",
      attributes: [{ name: "Variant Strength", has_variations: true, terms: [{ name: "1500mg", slug: "1500mg" }] }],
      variations: [{ id: 1, attributes: [{ name: "Variant Strength", value: "1500mg" }] }],
    });
    expect(parseTotalMg(wooQuantity(vici), vici.name)).toBe(1500);
  });

  it("resolves the readable term name behind a variation's attribute slug", () => {
    const purerawz = p({
      name: "GLOW Blend (BPC-157 + GHK-Cu + TB-500)",
      attributes: [
        { name: "Form", has_variations: true, terms: [{ name: "Peptides", slug: "peptides-2" }] },
        { name: "Dose", has_variations: true, terms: [{ name: "70mg", slug: "70mg" }] },
      ],
      variations: [{ id: 359330792, attributes: [{ name: "Form", value: "peptides-2" }, { name: "Dose", value: "70mg" }] }],
    });
    expect(wooVariationLabels(purerawz)).toEqual(["Peptides · 70mg"]);
    expect(wooQuantity(purerawz)).toBe("Peptides · 70mg");
    expect(parseTotalMg(wooQuantity(purerawz), purerawz.name)).toBe(70);
  });

  it("reads a spec block stating unit size and unit quantity (peptidepros.net bulk packs)", () => {
    const bulk = p({
      name: "BPC 157 &#8211; 50 VIALS AT 30 PERCENT OFF",
      type: "woosb",
      description: "[vc_row][vc_column][vc_column_text] Unit Size 5 mg/vial Unit Quantity 50 Vials Sequence Appearance White Powder",
    });
    expect(wooQuantity(bulk)).toBe("5mg/vial × 50 vials");
    expect(parseTotalMg(wooQuantity(bulk), bulk.name)).toBe(250);
  });

  it("reads a single size stated in the vendor's summary line (nootropicsource.com)", () => {
    const one = p({ name: "BPC 157 Peptide", short_description: "<p>Buy BPC 157 Peptide from Nootropic Source<br>5mg Vial Lyophilized Powder<br>Fast and free shipping on orders over $150 (USA ONLY)</p>" });
    expect(wooQuantity(one)).toBe("5mg");
    const two = p({ name: "LL-37 Acetate", short_description: "<p>Buy LL-37 Acetate Peptide from Nootropic Source<br>6mg in a Vial Lyophilized Powder</p>" });
    expect(wooQuantity(two)).toBe("6mg");
  });

  it("refuses to guess when the summary states more than one strength", () => {
    // A spray that states a per-spray dose and a bottle concentration is not a single size.
    const spray = p({ name: "BPC-157 Spray", short_description: "<p>Buy BCP 157 Spray from Nootropic Source<br>200mcg+ per spray<br>10mL bottle @ 2mg per mL</p>" });
    expect(wooQuantity(spray)).toBe("1 vial");
  });

  it("keeps the placeholder when the vendor publishes no size at all", () => {
    expect(wooQuantity(p({ name: "GHRP-2", short_description: "<p>GHRP-2 (KP 102) is a synthetic hexapeptide research compound studied in controlled laboratory environments.</p>" }))).toBe("1 vial");
    expect(wooQuantity(p({ name: "IPAM (Indolepropionamide)" }))).toBe("1 vial");
    expect(parseTotalMg(wooQuantity(p({ name: "GHRP-2" })), "GHRP-2")).toBeUndefined();
  });

  it("does NOT collapse a multi-option product to one size — those are resolved per variation", () => {
    // cernumbiosciences.com sells BPC-157 as 5MG and 10MG under one product whose payload exposes
    // only a price RANGE. Picking either size here would attribute the wrong price to it.
    const cernum = p({
      name: "BPC-157",
      prices: { price: "4999", price_range: { min_amount: "4999" }, currency_minor_unit: 2 },
      attributes: [{ name: "Size", has_variations: true, terms: [{ name: "5MG", slug: "5MG" }, { name: "10MG", slug: "10MG" }] }],
      variations: [{ id: 100, attributes: [{ name: "Size", value: "5MG" }] }, { id: 101, attributes: [{ name: "Size", value: "10MG" }] }],
    });
    expect(wooVariationLabels(cernum)).toEqual(["5MG", "10MG"]);
    expect(wooQuantity(cernum)).toBe("1 vial");
    expect(parseTotalMg(wooQuantity(cernum), cernum.name)).toBeUndefined();
  });

  it("strips the attribute-name prefix from a fetched variation label", () => {
    expect(wooVariationQuantity("Size: 5MG")).toBe("5MG");
    expect(wooVariationQuantity("Size: 10 Milligrams")).toBe("10 Milligrams");
    expect(wooVariationQuantity("Strength: 10mg, Pack Size: 10-vial kit")).toBe("10mg · 10-vial kit");
    expect(parseTotalMg(wooVariationQuantity("Strength: 10mg, Pack Size: 10-vial kit") ?? "", "Tesamorelin")).toBe(100);
    // Option values that state no size are not sizes.
    expect(wooVariationQuantity("Form: Lyophilized")).toBeNull();
    expect(wooVariationQuantity(undefined)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { wooPrice, wooQuantity, type WooProduct } from "@/server/ingest/woocommerce-import";

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

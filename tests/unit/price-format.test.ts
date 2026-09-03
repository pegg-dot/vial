import { describe, expect, it } from "vitest";
import { formatPricePerMg, formatMgTotal } from "@/lib/format";

// A formatter is an honesty surface. $25 for a 10-gram powder is $0.0025/mg — a REAL number the
// market page must show, not "$0.00/mg", which reads as either a broken site or a free product,
// and made the buy box ("$0.00/mg · -99% vs median") incoherent on screen. Precision adapts to
// magnitude so bulk powders and tiny vials both read true.
describe("formatPricePerMg — never renders a real price as $0.00", () => {
  it("keeps the familiar 2-decimal form for cent-and-up prices", () => {
    expect(formatPricePerMg(0.48)).toBe("$0.48/mg");
    expect(formatPricePerMg(4.8)).toBe("$4.80/mg");
    expect(formatPricePerMg(0.3)).toBe("$0.30/mg");
  });

  it("keeps 1 decimal for large per-mg prices", () => {
    expect(formatPricePerMg(12.53)).toBe("$12.5/mg");
  });

  it("extends precision below one cent instead of rounding to zero", () => {
    expect(formatPricePerMg(0.0025)).toBe("$0.0025/mg"); // $25 / 10g NAD+ powder
    expect(formatPricePerMg(0.005)).toBe("$0.005/mg");
    expect(formatPricePerMg(0.0012)).toBe("$0.0012/mg");
  });

  it("never emits the string $0.00/mg for any positive price", () => {
    for (const v of [0.0001, 0.0049, 0.0099, 0.004999, 0.00951]) {
      expect(formatPricePerMg(v)).not.toBe("$0.00/mg");
      expect(formatPricePerMg(v)).toMatch(/[1-9]/); // some significant digit survives
    }
  });
});

// Sizes: vendors sell 100mg vials AND 10-gram tubs. "10000mg total" is technically true and
// humanly unreadable; a terminal writes "10g".
describe("formatMgTotal — gram-scale sizes read as grams", () => {
  it("renders gram-scale totals in grams", () => {
    expect(formatMgTotal(10000)).toBe("10g");
    expect(formatMgTotal(1500)).toBe("1.5g");
    expect(formatMgTotal(1000)).toBe("1g");
  });

  it("keeps milligram-scale totals in mg", () => {
    expect(formatMgTotal(500)).toBe("500mg");
    expect(formatMgTotal(2.5)).toBe("2.5mg");
  });

  it("renders sub-milligram totals in mcg", () => {
    expect(formatMgTotal(0.5)).toBe("500mcg");
  });
});

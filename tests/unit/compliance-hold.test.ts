import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function file(path: string) {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
}

describe("public evidence-only safety constraints", () => {
  it("does not offer purchases or coupon links from listing components", () => {
    expect(file("../../src/components/product-actions.tsx")).not.toContain("Buy at");
    expect(file("../../src/components/vendor-offers-panel.tsx")).toContain("return null");
  });
  it("does not publish a shoppable Product Offer schema", () => {
    const source = file("../../src/app/products/[slug]/page.tsx");
    expect(source).not.toContain('"@type": "Offer"');
    expect(source).not.toContain('"@type": "Product"');
    expect(source).toContain('"@type": "Dataset"');
  });
  it("does not promote cheapest compound-stack assembly", () => {
    const list = file("../../src/app/stacks/page.tsx");
    const detail = file("../../src/app/stacks/[slug]/page.tsx");
    expect(list).toContain("comparisons are unavailable");
    expect(detail).not.toContain("cheapest listing");
    expect(detail).toContain("This combination analysis is paused");
  });
  it("does not advertise research labeling as a legal exemption", () => {
    const facts = file("../../src/lib/us-legal.ts");
    expect(facts).toContain("does not automatically");
    expect(facts).not.toContain("the line that keeps the sale outside FDA");
  });
  it("aligns policy pages with suspended referrals", () => {
    const privacy = file("../../src/app/legal/privacy/page.tsx");
    const terms = file("../../src/app/legal/terms/page.tsx");
    expect(privacy).toContain("The feature is disabled");
    expect(terms).toContain("does not sell listed products");
  });
});

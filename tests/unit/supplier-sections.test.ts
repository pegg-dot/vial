import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SupplierSections } from "@/components/intelligence/supplier-sections";
import type { SupplierRow } from "@/lib/supplier-grades";

const row = (over: Partial<SupplierRow> = {}): SupplierRow => ({
  slug: "acme", name: "Acme Labs", kind: "storefront", letter: "B", confidence: "tentative", headline: "Mostly consistent",
  certificates: 2, medianPurity: 98.2, passports: 0, latestTestedAt: "2026-09-01T00:00:00Z", gradedAt: null,
  enforcement: "caution", integrityFlagged: true, ...over,
});

describe("SupplierSections markup", () => {
  const html = renderToStaticMarkup(createElement(SupplierSections, { sections: [["Brands", [row(), row({ slug: "x", name: "Unrated Co", letter: null, confidence: "unrated", certificates: 0, medianPurity: null, latestTestedAt: null, enforcement: null, integrityFlagged: false })]]] }));

  it("shows the grade with its evidence and confidence beside it", () => {
    expect(html).toContain("Acme Labs");
    expect(html).toContain("Tentative grade");
    expect(html).toContain("98.2%");
    expect(html).toContain("2026-09-01");
    expect(html).toContain("Unrated grade");
    expect(html).toContain('aria-label="Grade not assigned"');
  });

  it("states regulatory and integrity flags as records, and carries no commerce wording or links", () => {
    expect(html).toContain("public regulatory action is on record");
    expect(html).toContain("certificate integrity flag is on record");
    expect(html).not.toMatch(/\bprice|buy|cart|checkout|available from|in stock|referral|<a /i);
  });
});

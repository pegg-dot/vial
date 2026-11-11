import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TestedByVendors } from "@/components/tested-by-vendors";
import type { VendorDirectoryEntry } from "@/lib/vendor-ranking";

const entry = (over: Record<string, unknown> = {}, websiteUrl: string | null = null): VendorDirectoryEntry => ({
  vendor: { slug: "acme", name: "Acme Labs", initials: "AL", accent: ["#eee", "#111"], kind: "storefront", coaCount: 3, passportCount: 1, medianPurity: 98.1,
    grade: { letter: "B", band: "mixed", headline: "h", rationale: "r", summary: "s", weighed: 3, verifiedCount: 3, gradedAt: "2026-09-02" }, ...over } as never,
  priceIndex: null, pricedListings: 0, enforcement: null, defunct: false, integrityFlagged: false, reviewSentiment: null, websiteUrl, verdict: "caution" as never, redFlag: false,
});

describe("TestedByVendors", () => {
  it("names each vendor with its letter and a link to its record, and nothing about buying", () => {
    const html = renderToStaticMarkup(createElement(TestedByVendors, { entries: [entry()], compoundName: "BPC-157", number: 3 }));
    expect(html).toContain("Who has lab evidence for BPC-157");
    expect(html).toContain("Acme Labs");
    expect(html).toContain('href="/vendors/acme"');
    expect(html).toContain("3 independent tests · 1 batch record");
    expect(html).toMatch(/aria-label="VialGrade B"/);
    expect(html).not.toMatch(/\bprice|\bbuy now|\bshop\b|cart|in stock|visit (?:the )?store|cheapest|\bbuy\b/i);
    expect(html).not.toContain("Website");
  });

  it("shows the storefront link only when the entry carries one, as a nofollow external link with the disclaimer", () => {
    const html = renderToStaticMarkup(createElement(TestedByVendors, { entries: [entry({}, "https://acme-peptides.com/")], compoundName: "BPC-157", number: 3 }));
    expect(html.match(/<a /g)).toHaveLength(2);
    expect(html).toContain('href="https://acme-peptides.com/"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain("not verified or endorsed by VialGrade");
  });

  it("marks an ungraded vendor as not rated instead of inventing a letter", () => {
    const html = renderToStaticMarkup(createElement(TestedByVendors, { entries: [entry({ grade: null })], compoundName: "BPC-157", number: 3 }));
    expect(html).toContain("Not rated");
    expect(html).not.toMatch(/aria-label="VialGrade [A-F]/);
  });
});

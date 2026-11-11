import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CompoundVendors, type CompoundVendorEntry } from "@/components/compound-vendors";
import type { VendorDirectoryEntry } from "@/lib/vendor-ranking";

const directoryEntry = (over: Record<string, unknown> = {}, websiteUrl: string | null = null): VendorDirectoryEntry => ({
  vendor: { slug: "acme", name: "Acme Labs", initials: "AL", accent: ["#eee", "#111"], kind: "storefront", coaCount: 3, passportCount: 1, medianPurity: 98.1,
    grade: { letter: "B", band: "mixed", headline: "h", rationale: "r", summary: "s", weighed: 3, verifiedCount: 3, gradedAt: "2026-09-02" }, ...over } as never,
  priceIndex: null, pricedListings: 0, enforcement: null, defunct: false, integrityFlagged: false, reviewSentiment: null, websiteUrl, verdict: "caution" as never, redFlag: false,
});
const row = (lists: boolean, evidence: boolean, over: Record<string, unknown> = {}, websiteUrl: string | null = null): CompoundVendorEntry =>
  ({ entry: directoryEntry(over, websiteUrl), lists, evidence });
const render = (vendors: CompoundVendorEntry[]) =>
  renderToStaticMarkup(createElement(CompoundVendors, { vendors, compoundName: "BPC-157", number: 3 }));

describe("CompoundVendors", () => {
  it("names each vendor with its letter, what ties it to the compound, and a link to its record — nothing about buying", () => {
    const html = render([row(true, true)]);
    expect(html).toContain("Who carries BPC-157, and what each record shows");
    expect(html).toContain("Acme Labs");
    expect(html).toContain('href="/vendors/acme"');
    expect(html).toContain("Lists BPC-157 · 3 independent tests · 1 batch record on its record");
    expect(html).toMatch(/aria-label="VialGrade B"/);
    expect(html).not.toMatch(/\bprice|\bbuy now|\bshop\b|cart|in stock|visit (?:the )?store|cheapest|\bbuy\b/i);
    expect(html).not.toContain("Website");
  });

  it("says when only the evidence names the compound, and when a listing vendor has no evidence at all", () => {
    expect(render([row(false, true)])).toContain("Evidence names BPC-157 · 3 independent tests");
    const bare = render([row(true, false, { coaCount: 0, passportCount: 0, grade: null })]);
    expect(bare).toContain("Lists BPC-157 · no independent evidence on its record");
    expect(bare).toContain("Not rated");
    expect(bare).not.toMatch(/aria-label="VialGrade [A-F]/);
  });

  it("shows the storefront link only when the entry carries one, as a nofollow external link with the disclaimer", () => {
    const html = render([row(true, false, {}, "https://acme-peptides.com/")]);
    expect(html.match(/<a /g)).toHaveLength(2);
    expect(html).toContain('href="https://acme-peptides.com/"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain("not verified or endorsed by VialGrade");
  });

  it("uses the section id the contents list and the hero pill point at", () => {
    expect(render([row(true, true)])).toContain('id="vendors"');
  });
});

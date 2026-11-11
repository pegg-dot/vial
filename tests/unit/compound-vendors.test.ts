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
const row = (lists: boolean, evidence: { tests?: number; batches?: number }, over: Record<string, unknown> = {}, websiteUrl: string | null = null): CompoundVendorEntry =>
  ({ entry: directoryEntry(over, websiteUrl), lists, tests: evidence.tests ?? 0, batches: evidence.batches ?? 0 });
const render = (vendors: CompoundVendorEntry[]) =>
  renderToStaticMarkup(createElement(CompoundVendors, { vendors, compoundName: "BPC-157", number: 3 }));

describe("CompoundVendors", () => {
  it("names each vendor with its letter, what ties it to the compound, and a link to its record — nothing about buying", () => {
    const html = render([row(true, { tests: 2, batches: 1 })]);
    expect(html).toContain("Who carries BPC-157, and what each record shows");
    expect(html).toContain("Acme Labs");
    expect(html).toContain('href="/vendors/acme"');
    expect(html).toContain("Lists BPC-157 · 2 independent tests · 1 batch record for BPC-157");
    expect(html).toMatch(/aria-label="VialGrade B"/);
    expect(html).not.toMatch(/\bprice|\bbuy now|\bshop\b|cart|in stock|visit (?:the )?store|cheapest|\bbuy\b/i);
    expect(html).not.toContain("Website");
  });

  it("counts this compound's own evidence per vendor, never the vendor-wide totals from the directory", () => {
    // The directory entry says 3 tests and 1 batch record vendor-wide; the compound's own lists say otherwise.
    expect(render([row(false, { batches: 1 })])).toContain("Evidence names BPC-157 · 1 batch record for BPC-157");
    expect(render([row(true, { tests: 1 })])).toContain("Lists BPC-157 · 1 independent test for BPC-157");
    const bare = render([row(true, {}, { grade: null })]);
    expect(bare).toContain("Lists BPC-157 · no independent evidence for BPC-157 on file");
    expect(bare).not.toContain("3 independent");
    expect(bare).toContain("Not rated");
    expect(bare).not.toMatch(/aria-label="VialGrade [A-F]/);
  });

  it("shows the storefront link only when the entry carries one, as a nofollow external link with the disclaimer", () => {
    const html = render([row(true, {}, {}, "https://acme-peptides.com/")]);
    expect(html.match(/<a /g)).toHaveLength(2);
    expect(html).toContain('href="https://acme-peptides.com/"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain("not verified or endorsed by VialGrade");
  });

  it("uses the section id the contents list and the hero pill point at", () => {
    expect(render([row(true, { tests: 1 })])).toContain('id="vendors"');
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VendorComparisonTable, VendorSideBySide, comparisonUrl } from "@/components/vendor-comparison";
import { PriceLeaderboard } from "@/components/price-leaderboard";
import { buildSourceComparison, pickSources, sortSources, type ComparisonTest } from "@/lib/source-comparison";
import type { Product } from "@/lib/types";

// The vendor comparison as it is drawn: one row per source, any two side by side. It links to
// vendor records, to itself, and out only as a plain citation (a listing on a released vendor
// site, a lab report). Never a product page, a click-through, a tagged URL or buying language.
const listing = (over: Partial<Product>): Product => ({
  slug: "acme-reta-10", name: "Retatrutide 10mg", compoundSlug: "retatrutide", vendorSlug: "acme-peptides", quantity: "10mg", mg: 10, pricePerMg: 12,
  price: 120, availability: "In stock", observedAt: "2026-11-02T10:00:00.000Z",
  externalUrl: "https://acme-peptides.com/products/retatrutide-10mg?ref=vialgrade&utm_source=vg#buy", ...over,
} as Product);
const report = (over: Partial<ComparisonTest>): ComparisonTest => ({
  lab: "Janoshik Analytical", verify_url: "https://verify.example/tests/1", sample_name: "Retatrutide 10mg", manufacturer: "Acme Peptides",
  vendor_slug: null, batch_code: "RT10", purity_pct: "99.12", measured_content: "10.4 mg", tested_at: "2026-09-10", test_type: "purity",
  is_blind: false, is_independent: true, ...over,
});

const LISTINGS = [
  listing({}),
  listing({ slug: "helix-reta-10", vendorSlug: "helix-science", pricePerMg: 15, price: 150, observedAt: "2026-10-01T10:00:00.000Z", externalUrl: "https://helix.example-shop.com/reta" }),
];
const REPORTS = [
  report({ vendor_slug: "acme-peptides", verify_url: "https://verify.example/tests/a1", is_blind: true }),
  report({ vendor_slug: "acme-peptides", verify_url: "https://verify.example/tests/a2", purity_pct: "98.30", measured_content: "7.1 mg", tested_at: "2026-10-12" }),
  report({ manufacturer: "www.mjtpeptides.com", verify_url: "https://verify.example/tests/m1", purity_pct: "99.94" }),
  report({ manufacturer: "Odd Scheme", verify_url: "javascript:alert(1)", purity_pct: "97.00" }),
];
const NAMES = new Map([["acme-peptides", "Acme Peptides"], ["helix-science", "Helix Science"]]);
const WEBSITES = new Map<string, string | null>([["acme-peptides", "https://acme-peptides.com/"], ["helix-science", null]]);
const BASE = "/compounds/retatrutide/vendors";
const SOURCES = buildSourceComparison(LISTINGS, REPORTS, NAMES).sources;

const BUYING = /add to cart|buy now|\bbuy\b|\bshop\b|\bdeal\b|\bcheapest\b|best value|\bwinner\b|recommended|visit (?:the )?store|checkout|coupon|discount/i;
const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const rowFor = (html: string, key: string) => new RegExp(`<tr[^>]*data-source="${key}"[^>]*>(.*?)</tr>`, "s").exec(html)![1];

describe("comparisonUrl", () => {
  it("leaves the default sort and empty picks out of the address", () => {
    expect(comparisonUrl(BASE, {})).toBe(BASE);
    expect(comparisonUrl(BASE, { sort: "coverage" })).toBe(BASE);
    expect(comparisonUrl(BASE, { sort: "purity", a: "acme-peptides", b: "_mjtpeptides-com" }, "side-by-side")).toBe(BASE + "?sort=purity&a=acme-peptides&b=_mjtpeptides-com#side-by-side");
  });
});

describe("VendorComparisonTable", () => {
  const render = (picked: string[] = [], sort: Parameters<typeof sortSources>[1] = "coverage") =>
    renderToStaticMarkup(createElement(VendorComparisonTable, { sources: sortSources(SOURCES, sort), sort, picked, base: BASE }));

  it("draws one row per source, listed or reported", () => {
    const html = render();
    expect([...html.matchAll(/data-source="([^"]+)"/g)].map((m) => m[1])).toEqual(["acme-peptides", "helix-science", "_mjtpeptides-com", "_odd-scheme"]);
  });

  it("puts price and lab result for the same source on the same row", () => {
    const acme = text(rowFor(render(), "acme-peptides"));
    expect(acme).toContain("1 listing");
    expect(acme).toContain("$12.0/mg");
    expect(acme).toContain("read 2026-11-02");
    expect(acme).toContain("98.3–99.1%");
    expect(acme).toContain("median 98.7%, 2 reports");
    expect(acme).toContain("1 blind");
    expect(acme).toContain("1 of 2 under label");
    expect(acme).toContain("2026-10-12");
  });

  it("shows a gap as a gap rather than a zero or a blank row", () => {
    const helix = text(rowFor(render(), "helix-science"));
    expect(helix).toContain("$15.0/mg");
    expect(helix).toContain("None on record");
    expect(helix).not.toMatch(/\d%/);
    const mjt = text(rowFor(render(), "_mjtpeptides-com"));
    expect(mjt).toContain("None on record");
    expect(mjt).toContain("99.9%");
    expect(mjt).toContain("Named on a lab report");
    expect(mjt).not.toContain("$");
  });

  it("links a vendor to its record and gives a source with no record no link of its own", () => {
    const html = render();
    expect(hrefs(rowFor(html, "acme-peptides"))).toContain("/vendors/acme-peptides");
    expect(hrefs(rowFor(html, "_mjtpeptides-com")).filter((h) => !h.startsWith(BASE))).toEqual([]);
  });

  it("links only to vendor records and to itself: no product page, click-through or outside site", () => {
    for (const html of [render(), render(["acme-peptides"]), render(["acme-peptides", "helix-science"], "purity")]) {
      const links = hrefs(html);
      expect(links.length).toBeGreaterThan(0);
      for (const href of links) expect(href).toMatch(/^\/vendors\/[a-z0-9-]+$|^\/compounds\/retatrutide\/vendors(?:[?#]|$)/);
    }
  });

  it("offers each sort as a link that keeps the picked pair, and marks the current one", () => {
    const html = render(["acme-peptides", "_mjtpeptides-com"], "purity");
    expect(hrefs(html)).toContain(BASE + "?sort=price&a=acme-peptides&b=_mjtpeptides-com");
    expect(hrefs(html)).toContain(BASE + "?a=acme-peptides&b=_mjtpeptides-com");
    expect(/<a[^>]*aria-current="true"[^>]*>([^<]*)/.exec(html)![1]).toBe("Reported purity, high to low");
    expect([...html.matchAll(/aria-current="true"/g)]).toHaveLength(1);
  });

  it("picks a first source, then a second, and lets either be removed", () => {
    expect(hrefs(rowFor(render(), "helix-science"))).toContain(BASE + "?a=helix-science");
    const one = render(["acme-peptides"]);
    expect(text(rowFor(one, "acme-peptides"))).toContain("Selected");
    expect(hrefs(rowFor(one, "acme-peptides"))).toContain(BASE);
    expect(hrefs(rowFor(one, "helix-science"))).toContain(BASE + "?a=acme-peptides&b=helix-science#side-by-side");
    const two = render(["acme-peptides", "helix-science"]);
    expect(hrefs(rowFor(two, "helix-science"))).toContain(BASE + "?a=acme-peptides");
    expect(hrefs(rowFor(two, "acme-peptides"))).toContain(BASE + "?a=helix-science");
    expect(hrefs(rowFor(two, "_mjtpeptides-com"))).toContain(BASE + "?a=acme-peptides&b=_mjtpeptides-com#side-by-side");
  });

  it("carries no buying language and names no winner", () => {
    for (const sort of ["coverage", "price", "purity", "reports", "read"] as const) expect(text(render([], sort))).not.toMatch(BUYING);
  });
});

describe("VendorSideBySide", () => {
  const render = (a?: string, b?: string, websites = WEBSITES) =>
    renderToStaticMarkup(createElement(VendorSideBySide, { compoundName: "Retatrutide", sources: SOURCES, picked: pickSources(SOURCES, a, b), sort: "coverage", base: BASE, websiteByVendor: websites }));

  it("with nothing picked it is only the picker, listing every source", () => {
    const html = render();
    expect([...html.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1])).toEqual(["", ...SOURCES.map((s) => s.key), "", ...SOURCES.map((s) => s.key)]);
    expect(html).toContain('method="get"');
    expect(html).toContain(`action="${BASE}#side-by-side"`);
    expect(html).not.toContain("data-source-detail");
    expect(text(html)).toContain("Choose two sources of Retatrutide");
  });

  it("sets two sources side by side: each one's figures, then every listing and report in full", () => {
    const html = render("acme-peptides", "_mjtpeptides-com");
    expect([...html.matchAll(/data-source-detail="([^"]+)"/g)].map((m) => m[1])).toEqual(["acme-peptides", "_mjtpeptides-com"]);
    const body = text(html);
    for (const measure of ["Listings on record", "Lowest price per mg, as read", "Independent lab reports", "Reported purity", "Content against label", "Most recent report"]) expect(body).toContain(measure);
    // Acme: its listing with the day read, and both reports with their own figures.
    expect(body).toContain("$120");
    expect(body).toContain("2026-11-02");
    expect(body).toContain("99.12%");
    expect(body).toContain("98.30%");
    expect(body).toContain("7.1 of 10mg, under label");
    expect(body).toContain("Blind");
    // The reported-only source: its report, and a plain statement that no listing is on record.
    expect(body).toContain("99.94%");
    expect(body).toContain("No mjtpeptides.com listing is on record for this compound");
    expect(html).toContain('<option value="acme-peptides" selected="">');
  });

  it("says so when a listed vendor has no report, instead of leaving the space empty", () => {
    const body = text(render("helix-science", "acme-peptides"));
    expect(body).toContain("No lab report attributed to Helix Science is on record for this compound");
    expect(body).toContain("The absence of a report is not a finding about the product");
  });

  it("cites a listing only on a vendor's released site, untagged, and a lab report only over http", () => {
    const external = hrefs(render("acme-peptides", "helix-science")).filter((h) => /^[a-z]+:/i.test(h));
    expect(external).toEqual(["https://acme-peptides.com/products/retatrutide-10mg", "https://verify.example/tests/a2", "https://verify.example/tests/a1"]);
    const html = render("acme-peptides", "helix-science");
    expect([...html.matchAll(/target="_blank"/g)].length).toBe(3);
    expect([...html.matchAll(/rel="noopener noreferrer nofollow"/g)].length).toBe(3);
    expect(html).toContain("not verified or endorsed by VialGrade");
    // No released website: no citation, and no sentence about citations.
    const none = render("acme-peptides", "helix-science", new Map());
    expect(hrefs(none).filter((h) => h.includes("acme-peptides.com"))).toEqual([]);
    expect(none).not.toContain("not verified or endorsed");
    // A report whose address is not a web address gets no link at all.
    expect(render("_odd-scheme")).not.toContain("javascript:");
  });

  it("never links a product page, a click-through, or a tagged URL", () => {
    for (const html of [render("acme-peptides", "helix-science"), render("_mjtpeptides-com", "acme-peptides"), render("helix-science")]) {
      for (const href of hrefs(html)) {
        expect(href).not.toMatch(/^\/products\/|^\/go\b|\/market$|^\/cart|^\/checkout|^\/compare|^\/stacks/);
        if (/^https?:/.test(href)) expect(href).not.toMatch(/[?#]|utm_|ref=/);
      }
    }
  });

  it("with one source picked it shows that source and asks for the second", () => {
    const html = render("helix-science");
    expect([...html.matchAll(/data-source-detail="([^"]+)"/g)].map((m) => m[1])).toEqual(["helix-science"]);
    expect(text(html)).toContain("Choose a second source to set beside Helix Science");
  });

  it("carries no buying language and reaches no verdict", () => {
    for (const html of [render(), render("acme-peptides"), render("acme-peptides", "_mjtpeptides-com"), render("helix-science", "acme-peptides")]) expect(text(html)).not.toMatch(BUYING);
    expect(text(render("acme-peptides", "helix-science"))).toContain("A side by side of records, not a verdict");
  });
});

describe("PriceLeaderboard's way on, in record mode", () => {
  it("leads to the vendor comparison, not to a market page", () => {
    const html = renderToStaticMarkup(createElement(PriceLeaderboard, { compoundName: "Retatrutide", listings: LISTINGS, labTests: [], record: { websiteByVendor: WEBSITES }, marketHref: BASE }));
    expect(hrefs(html)).toContain(BASE);
    expect(text(html)).toContain("Compare Retatrutide vendors side by side");
    expect(text(html)).not.toMatch(/full Retatrutide market/);
    expect(text(html)).not.toMatch(BUYING);
  });
});

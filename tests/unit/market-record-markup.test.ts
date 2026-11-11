import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PriceLeaderboard } from "@/components/price-leaderboard";
import { VendorCatalogRecord } from "@/components/vendor-catalog-record";
import type { Product } from "@/lib/types";

// The market record under the evidence-only release: a listing, its price, the day it was read and
// a plain citation of the listing. Never a product page, a tracked click-through or buying language.
const listing = (over: Partial<Product>): Product => ({
  slug: "acme-bpc-5", name: "BPC-157 5mg", compoundSlug: "bpc-157", vendorSlug: "acme-peptides", quantity: "5mg", mg: 5, pricePerMg: 12,
  price: 60, availability: "In stock", observedAt: "2026-11-02T10:00:00.000Z", lastChecked: "2 days ago",
  externalUrl: "https://acme-peptides.com/products/bpc-157-5mg?ref=vialgrade&utm_source=vg", ...over,
} as Product);

const LISTINGS = [
  listing({}),
  listing({ slug: "helix-bpc-10", name: "BPC-157 10mg", vendorSlug: "helix-science", mg: 10, pricePerMg: 9, price: 90, externalUrl: "https://helix.example-shop.com/bpc", observedAt: "2026-10-30T08:00:00.000Z" }),
];
const BUYING = /add to cart|buy now|\bbuy\b|\bshop now\b|\bdeal\b|visit (?:the )?store|checkout|coupon|discount/i;
const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);

describe("PriceLeaderboard as a market record", () => {
  const websiteByVendor = new Map<string, string | null>([["acme-peptides", "https://acme-peptides.com/"], ["helix-science", null]]);
  const render = (record?: { websiteByVendor: ReadonlyMap<string, string | null> }, listings = LISTINGS, marketHref?: string) =>
    renderToStaticMarkup(createElement(PriceLeaderboard, { compoundName: "BPC-157", listings, labTests: [], record, marketHref }));

  it("links each vendor to its evidence record and cites the listing only for a vendor whose website link is released", () => {
    const html = render({ websiteByVendor });
    const links = hrefs(html);
    expect(links).toContain("/vendors/acme-peptides");
    expect(links).toContain("/vendors/helix-science");
    // One citation, for the one vendor with a released website; the other row has none.
    const external = links.filter((h) => h.startsWith("http"));
    expect(external).toEqual(["https://acme-peptides.com/products/bpc-157-5mg"]);
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain("Source listing");
    expect(html).toContain("not verified or endorsed by VialGrade");
  });

  it("never links a product page, a click-through, or a tagged URL", () => {
    const html = render({ websiteByVendor });
    for (const href of hrefs(html)) {
      expect(href).not.toMatch(/^\/products\/|^\/go\b|\/market$/);
      expect(href).not.toMatch(/[?#]|utm_|ref=/);
    }
  });

  it("dates each price and carries no buying language", () => {
    const html = render({ websiteByVendor });
    expect(html).toContain("read 2026-11-02");
    expect(html).toContain("read 2026-10-30");
    expect(html).toContain("dated third-party observations, not offers or purchasing recommendations");
    expect(html.replace(/<[^>]+>/g, " ")).not.toMatch(BUYING);
  });

  it("cites nothing, and says nothing about citations, when no vendor's website link is released", () => {
    const html = render({ websiteByVendor: new Map() });
    expect(hrefs(html).filter((h) => h.startsWith("http"))).toEqual([]);
    expect(html).not.toContain("Source listing");
    expect(html).not.toContain("not verified or endorsed");
  });

  it("is still a record with a single listing, where a comparison would need two", () => {
    expect(render({ websiteByVendor }, [LISTINGS[0]])).toContain("/vendors/acme-peptides");
    expect(render(undefined, [LISTINGS[0]])).toBe("");
  });

  it("without the record mode it is the legacy table: product pages, no citation, no read date", () => {
    const html = render(undefined, LISTINGS, "/compounds/bpc-157/market");
    const links = hrefs(html);
    expect(links).toContain("/products/acme-bpc-5");
    expect(links).toContain("/compounds/bpc-157/market");
    expect(links.filter((h) => h.startsWith("http"))).toEqual([]);
    expect(html).not.toContain("Source listing");
    expect(html).not.toContain("read 2026-11-02");
  });
});

describe("VendorCatalogRecord", () => {
  const products = [
    listing({}),
    listing({ slug: "acme-tb-5", name: "TB-500 5mg", compoundSlug: "tb-500", price: 0, pricePerMg: undefined, mg: undefined, quantity: "", availability: "Unavailable", observedAt: undefined, externalUrl: "https://elsewhere.example/tb" }),
  ];
  const compoundNames = new Map([["bpc-157", "BPC-157"]]);
  const render = (websiteUrl: string | null) =>
    renderToStaticMarkup(createElement(VendorCatalogRecord, { products, vendorName: "Acme Peptides", compoundNames, websiteUrl }));

  it("lists what was read, the price as read, the day, and the compound's own page", () => {
    const html = render("https://acme-peptides.com/");
    expect(html).toContain("BPC-157 5mg");
    expect(html).toContain("$60");
    expect(html).toContain("2026-11-02");
    expect(html).toContain('href="/compounds/bpc-157"');
    // A compound we hold no name for gets no link; a listing with no price says so rather than $0.
    expect(html).not.toContain('href="/compounds/tb-500"');
    expect(html).toContain("no price read");
    expect(html).not.toMatch(/\$0(?:\.00)?</);
    expect(html).toContain("Unavailable when read");
  });

  it("cites only listings on the vendor's own released site, untagged", () => {
    const external = hrefs(render("https://acme-peptides.com/")).filter((h) => h.startsWith("http"));
    expect(external).toEqual(["https://acme-peptides.com/products/bpc-157-5mg"]);
    expect(hrefs(render(null)).filter((h) => h.startsWith("http"))).toEqual([]);
    expect(render(null)).not.toContain("Source listing");
  });

  it("links no product page or click-through and carries no buying language", () => {
    const html = render("https://acme-peptides.com/");
    for (const href of hrefs(html)) expect(href).not.toMatch(/^\/products\/|^\/go\b|[?#]/);
    expect(html).toContain("a dated observation of Acme Peptides");
    expect(html.replace(/<[^>]+>/g, " ")).not.toMatch(BUYING);
  });
});

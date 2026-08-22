import { describe, expect, it } from "vitest";
import { parseShopRating, ratingForDomain } from "@/server/collect/tracker-ratings";

// The Reputation dimension read `absent` for almost every vendor because all three of its inputs
// were hand-written files. Peptigrity is a third-party peptide-shop tracker that publishes a
// schema.org graph on each shop page, and crucially the shop node NAMES ITS OWN DOMAIN. That turns
// attribution from a guess into a check — which matters more here than anywhere, because pinning
// one vendor's reputation onto another is the worst thing this product can do.

const page = (nodes: unknown[]) =>
  `<html><head><script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": nodes })}</script></head><body>x</body></html>`;

const SHOP = {
  "@type": "Organization,OnlineStore",
  name: "corepeptides.com",
  url: "corepeptides.com",
  aggregateRating: { "@type": "AggregateRating", ratingValue: 4.6, bestRating: 5, worstRating: 1, ratingCount: 16, reviewCount: 16 },
};

// The tracker's own Organization node sits in the same graph on every page.
const TRACKER = { "@type": "Organization", name: "Peptigrity", url: "https://peptigrity.com" };

describe("reading a shop rating from a tracker page", () => {
  it("takes the rating from the shop node", () => {
    expect(parseShopRating(page([TRACKER, SHOP]))).toEqual({
      domain: "corepeptides.com", ratingValue: 4.6, bestRating: 5, ratingCount: 16, reviewCount: 16,
    });
  });

  // If this ever picked the tracker's own node, every vendor would inherit Peptigrity's rating.
  it("never returns the tracker's own organization", () => {
    const withTrackerRating = { ...TRACKER, aggregateRating: { ratingValue: 5, ratingCount: 999 } };
    expect(parseShopRating(page([withTrackerRating]))).toBeNull();
  });

  it("returns null when the shop node carries no rating", () => {
    expect(parseShopRating(page([TRACKER, { "@type": "Organization,OnlineStore", name: "x.com", url: "x.com" }]))).toBeNull();
  });

  it("returns null for a page with no graph at all", () => {
    expect(parseShopRating("<html><body>nothing</body></html>")).toBeNull();
  });

  it("survives an unparseable script block", () => {
    expect(parseShopRating(`<script type="application/ld+json">{oops</script>`)).toBeNull();
  });

  // A rating outside its own stated scale is a broken page, not a signal.
  it("refuses a rating outside the stated scale", () => {
    const bad = { ...SHOP, aggregateRating: { ratingValue: 9, bestRating: 5, ratingCount: 3 } };
    expect(parseShopRating(page([bad]))).toBeNull();
  });
});

describe("attributing a rating to a vendor", () => {
  const parsed = { domain: "corepeptides.com", ratingValue: 4.6, bestRating: 5, ratingCount: 16, reviewCount: 16 };

  it("accepts when the page names the vendor's own domain", () => {
    expect(ratingForDomain(parsed, "corepeptides.com")).not.toBeNull();
    expect(ratingForDomain(parsed, "www.CorePeptides.com")).not.toBeNull();
  });

  // The whole point. A redirect, a renamed slug, or a stale sitemap entry must not silently
  // attach one shop's reputation to a different vendor.
  it("refuses when the page is about a different shop", () => {
    expect(ratingForDomain(parsed, "chemyo.com")).toBeNull();
  });

  it("refuses when the page names no domain", () => {
    expect(ratingForDomain({ ...parsed, domain: "" }, "corepeptides.com")).toBeNull();
  });
});

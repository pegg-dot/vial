import { describe, expect, it } from "vitest";
import { parseShopRating, ratingForDomain, classifyTrustpilot } from "@/server/collect/tracker-ratings";

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

// Trustpilot publishes the same schema.org shape but identifies the business differently: `name`
// is the trading name ("Nootropic Source") and the domain lives in the review URL path. Reading
// only `name` gave "nootropic source", which matches no vendor, so every live profile silently
// resolved to nothing. The domain has to come from wherever the page actually states it — and it
// still has to match the vendor we asked about, which is the guard that matters.
describe("reading a rating from a Trustpilot profile", () => {
  const tp = (over = {}) => page([
    { "@type": "Organization", name: "Trustpilot", url: "https://www.trustpilot.com" },
    {
      "@type": "LocalBusiness",
      name: "Nootropic Source",
      url: "https://www.trustpilot.com/review/nootropicsource.com",
      aggregateRating: { "@type": "AggregateRating", bestRating: "5", worstRating: "1", ratingValue: "2", reviewCount: "110" },
      ...over,
    },
  ]);

  it("takes the domain from the review url and the rating as numbers", () => {
    expect(parseShopRating(tp())).toEqual({
      domain: "nootropicsource.com", ratingValue: 2, bestRating: 5, ratingCount: 110, reviewCount: 110,
    });
  });

  it("still attributes only to the vendor the page is about", () => {
    const parsed = parseShopRating(tp());
    expect(ratingForDomain(parsed, "nootropicsource.com")).not.toBeNull();
    expect(ratingForDomain(parsed, "chemyo.com")).toBeNull();
  });

  // Trustpilot's own Organization node must never be the answer, or every vendor inherits it.
  it("ignores Trustpilot's own organization record", () => {
    const onlyTrustpilot = page([
      { "@type": "Organization", name: "Trustpilot", url: "https://www.trustpilot.com", aggregateRating: { ratingValue: "4.5", reviewCount: "9999" } },
    ]);
    expect(parseShopRating(onlyTrustpilot)).toBeNull();
  });

  // A trading name that is not a domain, with no url to fall back on, is not enough to attribute.
  it("refuses to guess a domain from a trading name alone", () => {
    const noUrl = page([{ "@type": "LocalBusiness", name: "Nootropic Source", aggregateRating: { ratingValue: "2", reviewCount: "110" } }]);
    expect(parseShopRating(noUrl)).toBeNull();
  });
});

// This one nearly shipped a completely wrong dataset that looked entirely plausible.
//
// Trustpilot ships its whole i18n bundle in every page, including
// "business-profile-page/errors/parasiticseo/header":"This profile has been removed". So a regex
// over the raw HTML says "removed" for EVERY profile — including live ones with a real rating
// sitting right there. A first run reported 8 of 8 vendors removed, which is a believable claim
// about this market and was false.
//
// The rating is the evidence. Removal is only considered when there is no rating, and only from
// the rendered text a reader would actually see.
describe("classifying a Trustpilot profile", () => {
  const LIVE_HTML = page([
    { "@type": "Organization", name: "Trustpilot", url: "https://www.trustpilot.com" },
    {
      "@type": "LocalBusiness", name: "Nootropic Source",
      url: "https://www.trustpilot.com/review/nootropicsource.com",
      aggregateRating: { ratingValue: "2", bestRating: "5", reviewCount: "110" },
    },
  ]) + `<script>{"business-profile-page/errors/parasiticseo/header":"This profile has been removed"}</script>`;

  it("reads a live profile as rated even though the removal string is in the page bundle", () => {
    const r = classifyTrustpilot({ html: LIVE_HTML, markdown: "# Nootropic Source\nTrustScore 2", domain: "nootropicsource.com" });
    expect(r.state).toBe("rated");
    expect(r.rating?.ratingValue).toBe(2);
  });

  it("reads a genuinely removed profile from the rendered text", () => {
    const r = classifyTrustpilot({
      html: `<html>${LIVE_HTML.replace(/aggregateRating/g, "x")}</html>`,
      markdown: "# This profile has been removed\nThe business you're trying to find goes against our guidelines",
      domain: "chemyo.com",
    });
    expect(r.state).toBe("removed");
  });

  it("reads a profile with no rating and no removal notice as nothing published", () => {
    const r = classifyTrustpilot({ html: "<html></html>", markdown: "# Some Business\nnothing here", domain: "x.com" });
    expect(r.state).toBe("none");
  });

  // Attribution still governs: a rating for another business is not this vendor's.
  it("does not credit a rating that names a different business", () => {
    expect(classifyTrustpilot({ html: LIVE_HTML, markdown: "x", domain: "chemyo.com" }).state).toBe("none");
  });
});

import { describe, expect, it } from "vitest";
import { pageKind, referrerHost } from "@/server/analytics/visitors";

describe("page classification", () => {
  it("labels the pages that matter to the funnel", () => {
    expect(pageKind("/")).toBe("home");
    expect(pageKind("/products/chameleon-peptides-bpc-157")).toBe("product");
    expect(pageKind("/vendors/swiss-chems")).toBe("vendor");
    expect(pageKind("/compounds/bpc-157")).toBe("compound");
    expect(pageKind("/market")).toBe("market");
    expect(pageKind("/enforcement")).toBe("trust");
    expect(pageKind("/legal/terms")).toBe("other");
  });
});

describe("referrer handling", () => {
  it("keeps only the bare host, never the full URL or its query", () => {
    expect(referrerHost("https://www.reddit.com/r/Peptides/comments/abc?utm=1")).toBe("reddit.com");
    expect(referrerHost("https://google.com/search?q=bpc+157+scam")).toBe("google.com");
  });

  // Internal navigation is not a traffic source; counting it would drown out the real ones.
  it("treats our own site as direct, not a source", () => {
    expect(referrerHost("https://vialgrade.com/market", "vialgrade.com")).toBeNull();
    expect(referrerHost("https://www.vialgrade.com/market", "vialgrade.com")).toBeNull();
  });

  it("returns null for direct traffic and unparseable referrers", () => {
    expect(referrerHost(null)).toBeNull();
    expect(referrerHost("")).toBeNull();
    expect(referrerHost("not a url")).toBeNull();
  });
});

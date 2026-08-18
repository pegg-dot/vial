import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// The sitemap served a 26-hour-old, catalog-less response AFTER the database recovered — 20 URLs
// instead of ~1,000, x-vercel-cache: HIT — because the degraded fallback and `revalidate` were
// added in the same change, so the failure became the cached artifact. Google would have seen a
// site that had deleted its entire catalogue, while every page a human visits looked healthy.
//
// The invariant: a COMPLETE sitemap may be cached; a DEGRADED one never may.
vi.mock("@/server/catalog/repository", () => ({ getCatalogSnapshot: vi.fn() }));
vi.mock("@/server/observability/alerts", () => ({ reportError: vi.fn() }));

const { getCatalogSnapshot } = await import("@/server/catalog/repository");
const { GET } = await import("@/app/sitemap.xml/route");

describe("sitemap caching", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("caches a complete sitemap", async () => {
    vi.mocked(getCatalogSnapshot).mockResolvedValue({
      compounds: [{ slug: "bpc-157" }], vendors: [{ slug: "acme" }], products: [{ slug: "acme-bpc" }],
      generatedAt: new Date().toISOString(),
    } as never);
    const res = await GET();
    const cc = res.headers.get("cache-control") ?? "";
    expect(cc).toContain("s-maxage");
    expect(cc).not.toContain("no-store");
    const body = await res.text();
    expect(body).toContain("/compounds/bpc-157");
    expect(body).toContain("/vendors/acme");
  });

  it("never caches a degraded sitemap", async () => {
    vi.mocked(getCatalogSnapshot).mockRejectedValue(new Error("database unreachable"));
    const res = await GET();
    // This is the whole point. If this ever passes with a cacheable header, the exact failure that
    // hid a 20-URL sitemap behind a CDN HIT for 26 hours has been reintroduced.
    expect(res.headers.get("cache-control")).toContain("no-store");
    const body = await res.text();
    // Still serves the static routes — a sitemap that errors means crawlers discover nothing.
    expect(body).toContain("/grades");
    expect(body).not.toContain("/compounds/bpc-157");
  });

  it("emits well-formed XML in both states", async () => {
    vi.mocked(getCatalogSnapshot).mockRejectedValue(new Error("down"));
    const body = await (await GET()).text();
    expect(body.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(body).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(body.trimEnd().endsWith("</urlset>")).toBe(true);
    // Balanced entries — a truncated sitemap is rejected wholesale by crawlers.
    expect((body.match(/<url>/g) ?? []).length).toBe((body.match(/<\/url>/g) ?? []).length);
  });
});

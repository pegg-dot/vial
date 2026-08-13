import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWooProducts, StorefrontUnreachableError } from "@/server/ingest/woocommerce-import";

afterEach(() => { vi.unstubAllGlobals(); });

function stubFetch(handler: (url: string) => Response | Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(async (u: string | URL) => handler(String(u))));
}

// behemothlabz.com began returning 403 to every request — including robots.txt and the homepage.
// Before this, a wall like that was reported as a SUCCESSFUL import of zero products: the collector
// recorded ok=true, never backed off, and 53 frozen listings kept rendering as current prices.
describe("a storefront that refuses us is a failure, not an empty catalog", () => {
  it("raises on a hard block", async () => {
    stubFetch(() => new Response("blocked", { status: 403 }));
    await expect(fetchWooProducts("blocked.example")).rejects.toBeInstanceOf(StorefrontUnreachableError);
  });

  it("raises on rate limiting", async () => {
    stubFetch(() => new Response("slow down", { status: 429 }));
    await expect(fetchWooProducts("ratelimited.example")).rejects.toThrow(/429/);
  });

  it("raises when the host cannot be reached at all", async () => {
    stubFetch(() => { throw new Error("ENOTFOUND"); });
    await expect(fetchWooProducts("gone.example")).rejects.toBeInstanceOf(StorefrontUnreachableError);
  });

  // The one case that is genuinely "nothing to import" must still be quiet.
  it("returns null for a reachable store with an empty catalog", async () => {
    stubFetch(() => new Response("[]", { status: 200, headers: { "content-type": "application/json" } }));
    await expect(fetchWooProducts("empty.example")).resolves.toBeNull();
  });

  it("returns products when the store answers normally", async () => {
    stubFetch(() => new Response(JSON.stringify([{ name: "BPC-157", permalink: "https://x/p", type: "simple", is_in_stock: true, prices: { price: "4999", price_range: null, currency_minor_unit: 2 } }]), { status: 200, headers: { "content-type": "application/json" } }));
    const products = await fetchWooProducts("ok.example");
    expect(products).toHaveLength(1);
  });
});

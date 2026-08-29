import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWooCatalog } from "@/server/ingest/woocommerce-import";

// umbrella-labs: 600+ products over 6 pages at ~7 s a page on a slow host — 42 s sequential, past
// the tick budget, and the function was killed mid-import every hour. Pages after the first are
// independent requests; fetch them together, and stop asking when the deadline has passed.

const product = (i: number) => ({ id: i, name: `Product ${i}`, permalink: `https://vendor.example/p/${i}`, prices: { price: "1000", currency_minor_unit: 2 }, is_in_stock: true });
function pageServer(pages: number[], delayMs: number, totalPages?: number) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", (async (input: RequestInfo | URL) => {
    const url = String(input); calls.push(url);
    const page = Number(new URL(url).searchParams.get("page") ?? "1");
    await new Promise((r) => setTimeout(r, delayMs));
    const count = pages[page - 1] ?? 0;
    const body = Array.from({ length: count }, (_, i) => product((page - 1) * 100 + i));
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json", ...(totalPages ? { "x-wp-totalpages": String(totalPages), "x-wp-total": String(pages.reduce((a, b) => a + b, 0)) } : {}) } });
  }) as unknown as typeof fetch);
  return calls;
}
afterEach(() => vi.unstubAllGlobals());

describe("fetchWooCatalog", () => {
  it("fetches the pages after the first together, not one after another", async () => {
    // Fails while pages are fetched sequentially: six 60 ms pages take ≥ 360 ms.
    pageServer([100, 100, 100, 100, 100, 40], 60, 6);
    const t0 = Date.now();
    const cat = await fetchWooCatalog("vendor.example");
    const elapsed = Date.now() - t0;
    expect(cat?.products).toHaveLength(540);
    expect(cat?.complete).toBe(true);
    expect(elapsed).toBeLessThan(250);
  });

  it("reads more than six pages when the store has them", async () => {
    // Fails while maxPages is 6: umbrella-labs has more than 600 products.
    pageServer([100, 100, 100, 100, 100, 100, 100, 60], 5, 8);
    const cat = await fetchWooCatalog("vendor.example");
    expect(cat?.products).toHaveLength(760);
    expect(cat?.complete).toBe(true);
  });

  it("returns the first page alone, marked incomplete, when the deadline has already passed", async () => {
    // Fails while there is no deadline: a slow host is read to the end regardless of the tick.
    const calls = pageServer([100, 100, 100], 60, 3);
    const cat = await fetchWooCatalog("vendor.example", 10, { deadlineAt: Date.now() + 30 });
    expect(cat?.products).toHaveLength(100);
    expect(cat?.complete).toBe(false);
    expect(calls.filter((u) => /page=(2|3)/.test(u))).toHaveLength(0);
  });
});

import { expect, test } from "@playwright/test";

// Browse release: the original compound, vendor, lab and grade pages are readable again, with
// evidence and grades but no prices, listings or ways to buy. Needs VIALGRADE_PUBLIC_EVIDENCE_ONLY
// and VIALGRADE_PUBLIC_BROWSE both on.
test.describe("Browse release (read-only original pages)", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true" || process.env.VIALGRADE_PUBLIC_BROWSE !== "true", "Needs the browse release flags");

  const LEAKS = /\$\s?\d|\/\s?mg\b|add to cart|buy now|\bin stock\b|visit (?:the )?store|median combined|vs market|cheapest/i;

  for (const path of ["/compounds", "/compounds/bpc-157", "/vendors", "/vendors/arcwell-analytics", "/labs", "/labs/janoshik-analytical", "/grades", "/passports"]) {
    test(`${path} renders evidence with no prices, listings or buy paths`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator("main h1").first()).toBeVisible();
      const text = await page.locator("main").innerText();
      expect(text).not.toMatch(LEAKS);
      const hrefs = await page.locator("main a[href]").evaluateAll(els => els.map(e => e.getAttribute("href") ?? ""));
      expect(hrefs.filter(h => /^\/(go|cart|checkout|products)(\/|$)/.test(h) || /\/market$/.test(h))).toEqual([]);
    });
  }

  // Hiding a price in the markup is not enough: props to client components are serialized into the page.
  for (const path of ["/compounds", "/compounds/bpc-157", "/vendors", "/vendors/arcwell-analytics"]) {
    test(`${path} ships no price or listing data in its payload`, async ({ request }) => {
      const html = await (await request.get(path)).text();
      expect(html).not.toMatch(/"medianPrice(?:PerMg)?":[1-9]/);
      expect(html).not.toMatch(/\\?"(?:price|pricePerMg|priceIndex|externalUrl|productUrl)\\?":\s*[1-9"h]/);
      expect(html).not.toMatch(/"pricedListings\\?":\s*[1-9]/);
    });
  }

  test("a compound page leads with lab evidence and keeps the research and passport sections", async ({ page }) => {
    await page.goto("/compounds/bpc-157");
    await expect(page.getByText("Independent lab evidence on record")).toBeVisible();
    await expect(page.getByRole("button", { name: /follow/i })).toHaveCount(0);
  });

  test("a vendor page shows its grade and lab tests, not a catalog or offers", async ({ page }) => {
    await page.goto("/vendors/arcwell-analytics");
    await expect(page.locator("#lab-tests")).toBeVisible();
    await expect(page.locator("#catalog [class*=grid] a")).toHaveCount(0);
    await expect(page.locator("#offers, #reviews, #trackers")).toHaveCount(0);
  });

  test("the vendor directory has no price or buyer ranking", async ({ page }) => {
    await page.goto("/vendors");
    await expect(page.getByRole("button", { name: "Observed price" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reported sentiment" })).toHaveCount(0);
  });

  test("shop, market tables, product pages and click-throughs stay closed", async ({ page, request }) => {
    for (const path of ["/products/x", "/compounds/bpc-157/market", "/compounds/%6Darket", "/search", "/compare", "/market"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/intelligence/);
    }
    expect((await request.get("/go/anything", { maxRedirects: 0 })).status()).toBe(410);
    expect((await request.post("/api/v1/commerce/checkout", { data: {} })).status()).toBe(410);
    expect((await request.post("/vendors/arcwell-analytics", { data: {} })).status()).toBe(410);
  });
});

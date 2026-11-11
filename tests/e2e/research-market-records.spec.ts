import { expect, test } from "@playwright/test";

// Market-record release (VIALGRADE_MARKET_RECORDS=true on top of the evidence-only and browse
// releases): the price and listing blocks come back as a dated record, and nothing else of the
// shop does. Run this spec on its own in that mode; the browse specs assert the opposite (no price
// anywhere) and are meant for the mode with this flag off.
//
// Fixture: BPC-157 is listed by Helix Science, Northstar Research and Meridian Biosciences. The
// figures themselves are not pinned: the admin-workflow spec republishes a price, and Next's data
// cache on disk outlives the server, so a run after it sees whichever price was cached. What is
// pinned is the shape: every named vendor's row carries a price and the day it was read.
// No fixture vendor has a stored domain, so no source-listing or website link can render here; the
// citation rule is covered in tests/unit/vendor-source-link.test.ts and market-record-markup.test.ts.
const on = (name: string) => process.env[name] === "true";
const CLOSED_HREF = /^\/products(\/|$)|^\/go(\/|$)|^\/stacks(\/|$)|^\/compare$|^\/market$|\/market$|^\/cart|^\/checkout/;

test.describe("Market record", () => {
  test.skip(!on("VIALGRADE_PUBLIC_EVIDENCE_ONLY") || !on("VIALGRADE_PUBLIC_BROWSE") || !on("VIALGRADE_MARKET_RECORDS"), "Needs the evidence-only, browse and market-record flags");

  test("a compound page carries its listings as a dated record, after the evidence, with no way into the shop", async ({ page }) => {
    await page.goto("/compounds/bpc-157");
    await expect(page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: "Market record" })).toHaveAttribute("href", "#market");

    const market = page.locator("#market");
    await expect(market.getByRole("heading", { name: "What BPC-157 listings show, and when we read them" })).toBeVisible();
    await expect(market).toContainText("VialGrade sells nothing and takes no referrals");
    const rows = market.locator("tbody tr").filter({ has: page.locator("a[href^='/vendors/']") });
    await expect(rows).toHaveCount(3);
    for (const [vendor, slug] of [["Helix Science", "helix-science"], ["Northstar Research", "northstar-research"], ["Meridian Biosciences", "meridian-biosciences"]]) {
      const row = rows.filter({ hasText: vendor });
      await expect(row.getByRole("link", { name: vendor })).toHaveAttribute("href", "/vendors/" + slug);
      await expect(row).toContainText(/\$[1-9]\d*(\.\d{2})?/);
      await expect(row).toContainText(/read \d{4}-\d{2}-\d{2}/);
      await expect(row).toContainText(/\$\d+\.\d+\/mg/);
    }
    await expect(market).toContainText("dated third-party observations, not offers or purchasing recommendations");

    // Nothing in the record leads to a closed route, and with no stored domain nothing leads off the site.
    const hrefs = await market.locator("a[href]").evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
    expect(hrefs.filter((h) => CLOSED_HREF.test(h))).toEqual([]);
    expect(hrefs.filter((h) => /^https?:/.test(h))).toEqual([]);
    expect((await market.innerText())).not.toMatch(/add to cart|buy now|\bbuy\b|shop now|\bdeal\b|coupon|checkout/i);

    // The hero stays with the lab evidence; the price card and the follow button are not part of this release.
    await expect(page.getByText("Independent lab evidence on record")).toBeVisible();
    await expect(page.getByText("Observed median price")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /follow/i })).toHaveCount(0);
    await expect(page.locator("main a[href^='/stacks/']")).toHaveCount(0);
  });

  test("the record's table scrolls inside its own box on a phone instead of widening the page", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/compounds/bpc-157");
    await page.locator("#market").scrollIntoViewIfNeeded();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("directory cards show the lowest listed price, and the payload carries a listing's price but not its URL, photo or ratings", async ({ page, request }) => {
    await page.goto("/compounds");
    const card = page.locator("#catalog").getByRole("button", { name: "Quick view BPC-157" }).first();
    await expect(card).toContainText(/\$[1-9]\d*/);
    await expect(card).toContainText(/3 vendors · median \$[1-9]\d*/);
    await expect(page.locator("#catalog")).toContainText("a dated observation, not an offer");
    await expect(page.getByText("Popular stacks")).toHaveCount(0);

    await card.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Market low");
    const hrefs = await dialog.locator("a[href]").evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs.filter((h) => !/^\/(vendors|compounds)\/[a-z0-9-]+$/.test(h))).toEqual([]);

    const html = await (await request.get("/compounds")).text();
    expect(html).toContain("pricePerMg");
    for (const key of ["externalUrl", "imageUrl", "featured\\\""]) expect(html).not.toContain(key);
    expect(html).not.toMatch(/\\"rating\\":[1-9]|\\"reviewCount\\":[1-9]|\\"checkoutMode\\":\\"(?:outbound|marketplace-pending)/);
    const pageHrefs = await page.locator("main a[href]").evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
    expect(pageHrefs.filter((h) => CLOSED_HREF.test(h))).toEqual([]);
  });

  test("the vendor directory ranks and shows listing counts and the price index, never buyer sentiment", async ({ page }) => {
    await page.goto("/vendors");
    await expect(page.getByRole("button", { name: "Observed price" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reported sentiment" })).toHaveCount(0);
    const helix = page.locator("main").getByRole("link", { name: /Helix Science/ }).first();
    await expect(helix).toContainText("2 listings");
    await expect(page.locator("main")).not.toContainText(/buyer/i);
    const hrefs = await page.locator("main a[href]").evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
    expect(hrefs.filter((h) => CLOSED_HREF.test(h))).toEqual([]);
  });

  test("a vendor page carries its catalog as a dated table, and none of the other commerce sections", async ({ page }) => {
    await page.goto("/vendors/helix-science");
    const catalog = page.locator("#catalog-listings");
    await expect(catalog.getByRole("heading", { name: "What Helix Science lists, and the prices we read" })).toBeVisible();
    const record = page.getByTestId("vendor-catalog-record");
    await expect(record.locator("tbody tr")).toHaveCount(2);
    for (const row of await record.locator("tbody tr").all()) {
      await expect(row).toContainText(/\$[1-9]\d*/);
      await expect(row).toContainText(/\d{4}-\d{2}-\d{2}/);
    }
    await expect(record.getByRole("link", { name: "BPC-157 record" })).toHaveAttribute("href", "/compounds/bpc-157");
    await expect(record).toContainText("a dated observation of Helix Science");
    for (const id of ["offers", "reviews", "trackers", "signals"]) await expect(page.locator("#" + id)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /follow/i })).toHaveCount(0);
    await expect(page.getByText("Buyer reviews on file")).toHaveCount(0);
    const hrefs = await page.locator("main a[href]").evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
    expect(hrefs.filter((h) => CLOSED_HREF.test(h))).toEqual([]);
  });

  test("the flag opens no route: product pages, market tables, compare, stacks, click-throughs and carts stay closed", async ({ request }) => {
    for (const path of ["/products/helix-science-bpc-157", "/compounds/bpc-157/market", "/market", "/compare", "/stacks", "/cart", "/checkout"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(307);
      expect(response.headers().location, path).toContain("/intelligence?notice=retired");
    }
    expect((await request.get("/go/helix-science-bpc-157", { maxRedirects: 0 })).status()).toBe(410);
    expect((await request.post("/api/v1/commerce/cart", { data: {}, maxRedirects: 0 })).status()).toBe(410);
    expect((await request.get("/api/v1/catalog", { maxRedirects: 0 })).status()).toBe(410);
  });
});

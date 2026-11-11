import { expect, test } from "@playwright/test";

// Browse release: a compound page names the vendors its evidence names, each leading to its own
// record. The fixture's BPC-157 batch record belongs to Arcwell Analytics; no fixture vendor has a
// stored domain, so no storefront link can appear here whatever the vendor-link flag says.
test.describe("Tested by these vendors", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true" || process.env.VIALGRADE_PUBLIC_BROWSE !== "true", "Needs the browse release flags");

  test("the compound page lists the vendor behind its batch record, with a link to the vendor record", async ({ page }) => {
    await page.goto("/compounds/bpc-157");
    const section = page.locator("#tested-by");
    await expect(section).toBeVisible();
    await expect(section.getByRole("heading", { level: 2 })).toContainText("Who has lab evidence for BPC-157");
    await expect(section.getByText("Arcwell Analytics", { exact: true })).toBeVisible();
    await expect(section.getByRole("link", { name: "Arcwell Analytics vendor record" })).toHaveAttribute("href", "/vendors/arcwell-analytics");
    await expect(section.getByRole("link", { name: /website, external/ })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: "Tested by" })).toBeVisible();
    const text = await section.innerText();
    expect(text).not.toMatch(/\$\s?\d|\/\s?mg\b|add to cart|buy now|\bin stock\b|visit (?:the )?store|cheapest|price/i);
  });

  test("the vendor directory carries no storefront links for vendors without a stored domain", async ({ page }) => {
    await page.goto("/vendors");
    await expect(page.getByRole("link", { name: /website, external/ })).toHaveCount(0);
    const hrefs = await page.locator("main a[href]").evaluateAll(els => els.map(e => e.getAttribute("href") ?? ""));
    expect(hrefs.filter(h => /^\/go(\/|$)/.test(h))).toEqual([]);
  });
});

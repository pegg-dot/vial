import { expect, test } from "@playwright/test";

// Browse release: the way from a compound to the vendors that carry it is one click from the top of
// the compound page, and every directory card says how many vendors list the compound. The fixture's
// BPC-157 is listed by Helix Science, Meridian Biosciences and Northstar Research, and its batch
// record belongs to Arcwell Analytics; no fixture vendor has a stored domain, so no storefront link
// can appear whatever the vendor-link flag says. No price reaches either page.
test.describe("Vendors from compounds", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true" || process.env.VIALGRADE_PUBLIC_BROWSE !== "true", "Needs the browse release flags");

  test("the compound page lists every vendor that carries the compound or has evidence for it, one click from the hero", async ({ page }) => {
    await page.goto("/compounds/bpc-157");
    const hero = page.getByRole("link", { name: /^See \d+ vendors?$/ });
    await expect(hero).toHaveAttribute("href", "#vendors");
    await expect(hero).toHaveText("See 4 vendors");
    await expect(page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: "Vendors" })).toBeVisible();

    const section = page.locator("#vendors");
    await expect(section.getByRole("heading", { level: 2 })).toHaveText("Who carries BPC-157, and what each record shows");
    await expect(section.getByRole("listitem")).toHaveCount(4);
    for (const name of ["Helix Science", "Meridian Biosciences", "Northstar Research"]) {
      const item = section.getByRole("listitem").filter({ hasText: name });
      await expect(item).toContainText("Lists BPC-157 · no independent evidence for BPC-157 on file");
      await expect(item.getByRole("link", { name: name + " vendor record" })).toHaveAttribute("href", "/vendors/" + name.toLowerCase().replace(/ /g, "-"));
    }
    const arcwell = section.getByRole("listitem").filter({ hasText: "Arcwell Analytics" });
    // The page's own batch-record list, not the directory's vendor-wide count (which is 0 for this fixture vendor).
    await expect(arcwell).toContainText("Evidence names BPC-157 · 1 batch record for BPC-157");
    await expect(arcwell.getByRole("link", { name: "Arcwell Analytics vendor record" })).toHaveAttribute("href", "/vendors/arcwell-analytics");
    await expect(section.getByRole("link", { name: /website, external/ })).toHaveCount(0);

    await hero.click();
    await expect(section.getByRole("heading", { level: 2 })).toBeInViewport();
    const text = await section.innerText();
    expect(text).not.toMatch(/\$\s?\d|\/\s?mg\b|add to cart|buy now|\bin stock\b|visit (?:the )?store|cheapest|price/i);
  });

  test("the directory says how many vendors list each compound and points at the vendor directory, without shipping a listing", async ({ page, request }) => {
    await page.goto("/compounds");
    await expect(page.getByRole("link", { name: "Vendor directory" })).toHaveAttribute("href", "/vendors");
    await expect(page.getByText("Vendors", { exact: true }).first()).toBeVisible();
    const card = page.locator("#catalog").getByRole("link", { name: /BPC-157/ }).first();
    await expect(card).toContainText("3");
    await expect(card).toContainText("vendors");
    await expect(card).toContainText("independent lab");
    // The count travels alone: the evidence-only projection strips every product, so no listing field
    // is anywhere in the document, server-rendered or in the client payload.
    const html = await (await request.get("/compounds")).text();
    expect(html).not.toContain("vendorSlug");
    expect(html).not.toContain("pricePerMg");
  });

  test("the vendor directory carries no storefront links for vendors without a stored domain", async ({ page }) => {
    await page.goto("/vendors");
    await expect(page.getByRole("link", { name: /website, external/ })).toHaveCount(0);
    const hrefs = await page.locator("main a[href]").evaluateAll(els => els.map(e => e.getAttribute("href") ?? ""));
    expect(hrefs.filter(h => /^\/go(\/|$)/.test(h))).toEqual([]);
  });
});

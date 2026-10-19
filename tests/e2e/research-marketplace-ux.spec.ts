import { expect, test } from "@playwright/test";

test.describe("marketplace-like browsing with research-only sources", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true", "Public research release only");

  test("lets visitors browse a visual category rail and a selected official-study shelf", async ({ page }) => {
    await page.goto("/intelligence");
    await expect(page.getByRole("heading", { name: /Pick a peptide/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Start with an actual study" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Selected clinical study source shelf" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Showing 8 of 16 subjects" })).toBeVisible();
    await expect(page.locator('[data-testid="research-card"]')).toHaveCount(8);
    await expect(page.getByRole("button", { name: "Quick view Cagrilintide" }).first()).toBeVisible();

    await page.getByRole("button", { name: /Host defense & antimicrobials/ }).click();
    await expect(page.getByRole("status").filter({ hasText: "Showing 4 of 16 subjects" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Selected clinical study source shelf" })).toHaveCount(0);
    await expect(page.locator('[data-testid="research-card"]')).toHaveCount(4);
    await expect(page.getByRole("heading", { name: "Pexiganan", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Semaglutide", exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Clear filters" }).click();
    await page.getByRole("button", { name: /Selected trial example/ }).click();
    await expect(page.getByRole("status").filter({ hasText: "Showing 5 of 16 subjects" })).toBeVisible();
    await expect(page.locator('[data-testid="research-card"]')).toHaveCount(5);
    await page.getByRole("button", { name: /Identity source only/ }).click();
    await expect(page.getByRole("status").filter({ hasText: "Showing 11 of 16 subjects" })).toBeVisible();
    await expect(page.locator('[data-testid="research-card"]')).toHaveCount(11);
  });

  test("supports real quick-view, source links, Escape-to-close and compare selections", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto("/intelligence");
    await page.getByRole("button", { name: "Quick view Cagrilintide" }).first().click();
    const quick = page.getByRole("dialog", { name: "Quick research view: Cagrilintide" });
    await expect(quick).toBeVisible();
    await expect(quick.getByRole("heading", { name: "Cagrilintide" })).toBeVisible();
    await expect(quick.getByRole("link", { name: "Original identity record" }))
      .toHaveAttribute("href", "https://pubchem.ncbi.nlm.nih.gov/compound/171397054");
    await expect(quick.getByText("Selected trial · NCT05804162")).toBeVisible();
    await expect(quick.getByRole("link", { name: /Open research dossier/ }))
      .toHaveAttribute("href", "/intelligence/explore/cagrilintide");
    await expect(quick.getByRole("link", { name: /Buy|Checkout|Seller|Shop/ })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(quick).not.toBeVisible();

    await page.getByRole("button", { name: "Quick view Cagrilintide" }).first().click();
    await quick.getByRole("button", { name: "Add to compare" }).click();
    await expect(quick).not.toBeVisible();
    await expect(page.getByRole("region", { name: "Comparison selection" })).toContainText("Cagrilintide");

    const search = page.getByRole("searchbox", { name: "Search research subjects" });
    await search.fill("LY3298176");
    await expect(page.getByRole("heading", { name: "Tirzepatide", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Compare Tirzepatide" }).click();
    await expect(page.getByRole("link", { name: "Compare subjects" }))
      .toHaveAttribute("href", "/intelligence/compare?subjects=cagrilintide%2Ctirzepatide&audience=researcher");
    await page.getByRole("link", { name: "Compare subjects" }).click();
    await expect(page.getByRole("heading", { name: "Compare what matters to the research." })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("keeps product-style dossier useful without shopping or a horizontal mobile overflow", async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/intelligence");
    await expect(page.getByRole("heading", { name: /Pick a peptide/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Host defense & antimicrobials/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);

    await page.getByRole("button", { name: "Quick view Cagrilintide" }).first().click();
    await expect(page.getByRole("dialog", { name: "Quick research view: Cagrilintide" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
    await page.getByRole("button", { name: "Close quick view" }).click();

    await page.goto("/intelligence/explore/cagrilintide");
    await expect(page.getByRole("navigation", { name: "Research dossier sections" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Trial evidence", exact: true })).toHaveAttribute("href", "#evidence-review");
    await expect(page.getByRole("heading", { name: "Cagrilintide", level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
    for (const route of ["/api/v1/commerce/checkout", "/api/v1/commerce/cart", "/api/partner/conversion"]) {
      const response = await request.post(route, { data: {}, maxRedirects: 0 });
      expect(response.status(), route).toBe(410);
    }
  });
});

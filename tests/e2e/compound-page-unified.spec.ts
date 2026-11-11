import { expect, test } from "@playwright/test";

// One page per compound. A research file (pexiganan) and a catalog record (bpc-157) share one
// route; the old dossier address forwards. Under the evidence-only release a page with a research
// file is public whether or not the browse release is on; the catalog parts need the browse release.
test.describe("One page per compound", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true", "Research-only preview");
  const browse = process.env.VIALGRADE_PUBLIC_BROWSE === "true";

  test("the dossier address forwards permanently to the compound page, keeping the hash", async ({ page, request }) => {
    const hop = await request.get("/intelligence/explore/pexiganan", { maxRedirects: 0 });
    expect(hop.status()).toBe(308);
    expect(hop.headers().location).toBe("/compounds/pexiganan");
    await page.goto("/intelligence/explore/pexiganan#studies");
    await expect(page).toHaveURL(/\/compounds\/pexiganan#studies$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Pexiganan");
  });

  test("a compound with a research file is public and carries the file's six sections in order", async ({ page }) => {
    const res = await page.goto("/compounds/pexiganan");
    expect(res?.status()).toBe(200);
    const ids = await page.locator("main section[id]").evaluateAll(els => els.map(e => e.id));
    const order = ["overview", "file-grade", "studies", "sources", "material-evidence", "related"].map(id => ids.indexOf(id));
    expect(order.every(i => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    await expect(page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: /Overview/ })).toBeVisible();
    await expect(page.locator("main h1")).toHaveCount(1);
    // Pexiganan has no catalog record in the fixtures, so no catalog section may appear.
    await expect(page.locator("#understand, #lab-tests, #research, #stacked")).toHaveCount(0);
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/\$\s?\d|\/\s?mg\b|add to cart|buy now|\bin stock\b|visit (?:the )?store|cheapest/i);
  });

  test("an unknown slug is a 404, not a blank page", async ({ page }) => {
    const res = await page.goto("/compounds/not-a-compound-at-all");
    expect(res?.status()).toBe(browse ? 404 : 307);
  });

  test("a catalog-only compound carries no research-file sections", async ({ page }) => {
    test.skip(!browse, "Catalog pages need the browse release");
    const res = await page.goto("/compounds/bpc-157");
    expect(res?.status()).toBe(200);
    await expect(page.locator("#overview, #file-grade, #studies, #sources, #material-evidence, #related")).toHaveCount(0);
    await expect(page.locator("#lab-tests")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "On this page" })).toBeVisible();
  });
});

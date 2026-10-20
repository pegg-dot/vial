import { expect, test } from "@playwright/test";

test.describe("archived VialGrade discovery mechanics restored for research-only mode", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true", "Research-only public release");

  test("retains the original authored landing, narrative and first action without old claims", async ({ page }) => {
    await page.goto("/intelligence");
    await expect(page.getByRole("heading", { level: 1, name: /Know what's behind the claim/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Check an exact source ID in the Pexiganan pilot" }))
      .toHaveAttribute("href", "/intelligence/verify");
    await expect(page.getByRole("heading", { name: /A claim isn't the evidence/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Everything you'd check/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /What are you researching/ })).toBeVisible();
    await expect(page.getByText("16", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /The compounds.*in the research library/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /A record you can inspect for yourself/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Browse all 16 research records/ }))
      .toHaveAttribute("href", "/intelligence/market#browse");
    await expect(page.getByRole("link", { name: /Buy|Checkout|Shop|Vendor listing/i })).toHaveCount(0);
  });

  test("preserves global command search and follows an exact alias to a source dossier", async ({ page }) => {
    await page.goto("/intelligence");
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog", { name: "Search compounds and sources" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("searchbox", { name: "Search compound name, alias or study ID" }).fill("LY3437943");
    await expect(dialog.getByRole("link", { name: /Retatrutide/ })).toHaveAttribute("href", "/intelligence/explore/retatrutide");
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("research market keeps curated horizontal shelves and source-linked comparison", async ({ page }) => {
    await page.goto("/intelligence/market");
    await expect(page.getByRole("heading", { name: /The research,/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Studies on file" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Related research, kept separate" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Across the research areas" })).toBeVisible();
    await expect(page.locator('[data-testid="research-card"]')).toHaveCount(16);
    const shelf = page.getByRole("button", { name: "Quick view Semaglutide" }).first();
    await shelf.click();
    await expect(page.getByRole("dialog", { name: "Quick research view: Semaglutide" })).toBeVisible();
    await page.getByRole("button", { name: "Next research record" }).click();
    await expect(page.getByRole("dialog", { name: "Quick research view: Tirzepatide" })).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("dialog", { name: "Quick research view: Semaglutide" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await page.getByRole("button", { name: "Quick view Pexiganan" }).first().click();
    const source = page.getByRole("dialog", { name: "Quick research view: Pexiganan" });
    await expect(source.getByRole("link", { name: "Original identity record" })).toHaveAttribute("href", "https://pubchem.ncbi.nlm.nih.gov/compound/16132253");
  });

  test("market category URLs prefilter real records without a sales or referral path", async ({ page, request }) => {
    await page.goto("/intelligence/market?theme=host-defense#browse");
    await expect(page.getByRole("status").filter({ hasText: "Showing 4 of 16 compounds" })).toBeVisible();
    await expect(page.locator('[data-testid="research-card"]')).toHaveCount(4);
    await page.locator('[data-testid="research-card"]').getByRole("button", { name: "Quick view Pexiganan" }).click();
    const dialog = page.getByRole("dialog", { name: "Quick research view: Pexiganan" });
    await expect(dialog).toContainText("NCT01594762");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("dialog", { name: "Quick research view: Nisin A" })).toBeVisible();
    for (const blocked of ["/api/v1/commerce/checkout", "/api/partner/conversion"]) {
      const response = await request.post(blocked, { data: {}, maxRedirects: 0 });
      expect(response.status(), blocked).toBe(410);
    }
    const previous = await request.get("/market", { maxRedirects: 0 });
    expect(previous.status()).toBe(307);
    expect(previous.headers().location).toContain("/intelligence?notice=retired");
  });

  test("filters, sort and compare selection survive opening a dossier and pressing Back", async ({ page }) => {
    await page.goto("/intelligence/market");
    const browse = page.locator("section").filter({ has: page.locator("h2", { hasText: "Browse everything" }) }).first();
    await page.getByRole("button", { name: "Host defense & antimicrobials" }).first().click();
    await page.getByText("More filters").click();
    await page.getByLabel("Sort research file coverage").selectOption("source-coverage");
    await browse.locator('button[aria-label^="Compare "]').first().click();
    const names = () => browse.locator('button[aria-label^="Quick view"]').evaluateAll(els => els.map(e => e.getAttribute("aria-label")));
    const before = await names();
    expect(before.length).toBeLessThan(16);
    await browse.locator('a[aria-label^="Open research dossier:"]').first().click();
    await expect(page).toHaveURL(/\/intelligence\/explore\//);
    await page.goBack();
    await expect(page.getByRole("button", { name: "Host defense & antimicrobials" }).first()).toHaveAttribute("aria-pressed", "true");
    expect(await names()).toEqual(before);
    await expect(page.getByRole("region", { name: "Comparison selection" })).toBeVisible();
    // Hand-edited garbage falls back to the default list instead of breaking the page.
    await page.goto("/intelligence/market?theme=%3Cx%3E&sort=zzz&compare=nope");
    await expect(browse.locator('button[aria-label^="Quick view"]')).toHaveCount(16);
  });

  test("every in-page jump link on a dossier points at an element that exists", async ({ page }) => {
    for (const slug of ["pexiganan", "oxytocin", "retatrutide"]) {
      await page.goto("/intelligence/explore/" + slug);
      const missing = await page.evaluate(() => [...document.querySelectorAll('main a[href^="#"]')]
        .map(a => a.getAttribute("href")!).filter(h => h.length > 1 && !document.getElementById(h.slice(1))));
      expect(missing, slug).toEqual([]);
    }
  });

  test("desktop and mobile preserve original hierarchy without overflow or inaccessible menu", async ({ page }) => {
    for (const width of [1440, 1024, 390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      for (const route of ["/intelligence", "/intelligence/market"]) {
        const response = await page.goto(route);
        expect(response?.status(), route).toBe(200);
        expect(await page.evaluate(() => document.documentElement.scrollWidth), width + "px " + route).toBeLessThanOrEqual(width + 1);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/intelligence");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("navigation", { name: "Mobile research links" }).getByRole("link", { name: "Market" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Mobile research links" }).getByRole("link", { name: "Verify" })).toBeVisible();
    await page.getByRole("navigation", { name: "Mobile research links" }).getByRole("link", { name: "Market" }).click();
    await expect(page).toHaveURL(/\/intelligence\/market$/);
  });
});

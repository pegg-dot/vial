import { expect, test } from "@playwright/test";

test.describe("Connected research market entry points", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true", "Research-only view");

  test("makes the dossier, passport, verifier, organization attribution and comparison discoverable", async ({ page }) => {
    await page.goto("/intelligence");
    await expect(page.getByRole("heading", { name: "Go deeper" })).toBeVisible();
    const links = [
      ["Open Pexiganan dossier", "/intelligence/explore/pexiganan"],
      ["See evidence passport", "/intelligence/passports/pexiganan"],
      ["Try source verifier", "/intelligence/verify?ref=PMID%2036781451"],
      ["Explore source organizations", "/intelligence/organizations"],
      ["Compare Magainin 2 and Pexiganan", "/intelligence/compare?subjects=magainin-2%2Cpexiganan"],
    ];
    for (const [label, href] of links) {
      await expect(page.getByRole("link", { name: label })).toHaveAttribute("href", href);
      const result = await page.request.get(href);
      expect(result.status(), label).toBe(200);
    }
    await expect(page.getByRole("button", { name: /Buy|Checkout|Purchase/ })).toHaveCount(0);
  });

  test("keeps entry point cards legible on a phone and checkout quarantined", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/intelligence");
    await expect(page.getByRole("heading", { name: "Go deeper" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
    const forbidden = await page.request.post("/api/v1/commerce/checkout", { data: {} });
    expect(forbidden.status()).toBe(410);
  });
});

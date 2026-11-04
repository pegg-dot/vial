import { expect, test } from "@playwright/test";

test.describe("Recently updated strip", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true", "Research-only preview");

  test("shows dated review entries that link inside the research area and say what the date means", async ({ page }) => {
    await page.goto("/intelligence");
    const strip = page.getByRole("region", { name: "Recently updated" });
    await expect(strip).toBeVisible();
    await expect(strip.getByText(/not when a study changed/)).toBeVisible();
    const items = strip.getByRole("listitem");
    await expect(items).toHaveCount(4);
    await expect(strip.locator("time").first()).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}$/);
    for (const link of await strip.getByRole("link").all()) {
      expect(await link.getAttribute("href")).toMatch(/^\/intelligence\//);
    }
    await strip.getByRole("link", { name: /Pexiganan evidence passport/ }).click();
    await expect(page).toHaveURL(/\/intelligence\/passports\/pexiganan/);
  });

  test("uses no selling language", async ({ page }) => {
    await page.goto("/intelligence");
    const text = (await page.getByRole("region", { name: "Recently updated" }).innerText()).toLowerCase();
    for (const word of ["buy", "shop", "price", "cart", "available from", "in stock"]) expect(text).not.toContain(word);
  });
});

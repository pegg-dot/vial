import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.describe("one-task clinical trial source lookup", () => {
  test("accepts a trial ID, rejects irrelevant input and shows an honest answer", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto("/intelligence");
    await expect(page.getByRole("heading", { name: /Know what.s behind the claim/ })).toBeVisible();

    const input = page.getByRole("search").getByLabel("ClinicalTrials.gov study ID or link");
    await input.fill("retatrutide");
    await page.getByRole("button", { name: "Check evidence" }).click();
    await expect(page.locator("#trial-error-start")).toContainText("Enter a study ID");
    await expect(page).toHaveURL(/\/intelligence$/);

    await input.fill("nct05804162");
    await page.getByRole("button", { name: "Check evidence" }).click();
    await expect(page).toHaveURL(/\/intelligence\/studies\/NCT05804162$/);
    const issue = page.getByRole("heading", { name: "Registry temporarily unavailable" });
    if (await issue.isVisible()) {
      await expect(page.getByRole("link", { name: "Check ClinicalTrials.gov directly" })).toHaveAttribute(
        "href", "https://clinicaltrials.gov/study/NCT05804162",
      );
    } else {
      await expect(page.getByRole("heading", { name: "Evidence for NCT05804162" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Original sources" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Open registry record" })).toHaveAttribute("href", "https://clinicaltrials.gov/study/NCT05804162");
      await expect(page.getByRole("heading", { name: "What to verify next" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Copy brief" })).toBeVisible();
      const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download brief" }).click()]);
      expect(download.suggestedFilename()).toBe("vialgrade-nct05804162-source-brief.md");
      const markdown = await readFile(await download.path(), "utf8");
      expect(markdown).toContain("https://clinicaltrials.gov/study/NCT05804162");
      expect(markdown).toContain("No historical record-version comparison or comprehensive literature search");
      await expect(page.getByRole("button", { name: /Buy|Checkout/i })).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });

  test("works for a second trial ID without depending on a fixed molecule", async ({ page }) => {
    await page.goto("/intelligence/studies/NCT03856047");
    const heading = page.getByRole("heading", { name: "Evidence for NCT03856047" });
    const unavailable = page.getByRole("heading", { name: "Registry temporarily unavailable" });
    await expect(heading.or(unavailable)).toBeVisible();
    if (await heading.isVisible()) {
      await expect(page.getByRole("link", { name: "Open registry record" })).toHaveAttribute("href", "https://clinicaltrials.gov/study/NCT03856047");
    }
  });

  test("rejects malformed routes without sending unbounded provider requests", async ({ page }) => {
    const response = await page.request.get("/intelligence/studies/not-a-trial", { maxRedirects: 0 });
    expect(response.status()).toBe(307); // Deny-by-default perimeter, not a public data lookup.
    expect(response.headers().location).toContain("/login");
  });

  test("keeps the input and source check usable at phone width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/intelligence");
    await expect(page.getByRole("search").getByRole("button", { name: "Check evidence" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
    await page.goto("/intelligence/studies/NCT05804162");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
    await expect(page.getByRole("link", { name: "Back to study lookup" })).toBeVisible();
    await expect(page.getByRole("search")).toBeHidden();
  });

  test("keeps checkout, partner referrals and vendor sync paused", async ({ request }) => {
    for (const path of ["/api/v1/commerce/checkout", "/api/v1/commerce/cart", "/api/partner/conversion", "/go/test-vendor"]) {
      const response = await request.post(path, { data: {}, maxRedirects: 0 });
      expect(response.status(), path).toBe(410);
    }
  });
});

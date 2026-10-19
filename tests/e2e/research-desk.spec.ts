import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.describe("Source-grounded Research Desk pilot", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true", "Research-only preview");

  test("opens from research market, switches questions and exports inspectable source packets", async ({ page }) => {
    await page.goto("/intelligence");
    await expect(page.getByRole("link", { name: "Open Research Desk" }).first()).toHaveAttribute("href", "/intelligence/desk");
    await page.getByRole("link", { name: "Open Research Desk" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: /Ask better questions/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your research brief" })).toBeVisible();
    await page.getByRole("button", { name: /Clinical program/ }).click();
    await expect(page.getByRole("heading", { name: /Which pexiganan trials have registered results/ })).toBeVisible();
    await expect(page.getByText("What it does not establish").first()).toBeVisible();
    await page.getByRole("button", { name: "Analyst" }).click();
    await page.getByPlaceholder(/Which pexiganan trials/).fill("What records mention trial sponsors?");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download source briefing" }).click(),
    ]);
    expect(download.suggestedFilename()).toContain("clinical-trials-source-brief");
    const content = await readFile(await download.path(), "utf8");
    expect(content).toContain("What records mention trial sponsors?");
    expect(content).toContain("NCT01594762");
    expect(content).toContain("No model analysis was executed");
    expect(content).toContain("Does NOT establish");
    expect(await page.getByRole("button", { name: "Copy source pack for an AI model" }).count()).toBe(1);
    expect(await page.getByRole("button", { name: /Buy|Order|Checkout|Purchase/ }).count()).toBe(0);
  });

  test("keeps connected source routes public and the phone layout readable", async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ["/intelligence/desk", "/intelligence/explore/pexiganan", "/intelligence/materials"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(391);
    }
    expect((await request.post("/api/v1/commerce/checkout", {data: {}})).status()).toBe(410);
  });
});

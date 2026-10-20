import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.describe("Source-grounded Research Desk pilot", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true", "Research-only preview");

  test("opens from research market, switches questions and exports inspectable source packets", async ({ page }) => {
    await page.goto("/intelligence");
    await expect(page.getByRole("link", { name: "Open Research Desk" }).first()).toHaveAttribute("href", "/intelligence/desk");
    await page.getByRole("link", { name: "Open Research Desk" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Research Desk" })).toBeVisible();
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
  test("a selection fills the working panel on screen and shows its source without another click", async ({ page }) => {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/intelligence/desk?topic=identity");
      await page.getByRole("button", { name: /Clinical program/ }).click();
      const heading = page.getByRole("heading", { name: /Which pexiganan trials have registered results/ });
      await expect(heading).toBeInViewport({ ratio: 1 });
      await expect(page).toHaveURL(/topic=clinical-trials/);
      // Identifier + limitation of the first source are already inspectable (no accordion).
      await expect(page.getByRole("button", { name: "NCT01594762", exact: true }).first()).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByText("What this record does not prove").first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width + 1);
    }
  });

  test("the evidence panel has no stretched empty tail and the source inspector switches records", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/intelligence/desk?topic=publication-matching");
    const gap = await page.evaluate(() => {
      const panel = document.getElementById("desk-evidence-heading")!.closest("section")!;
      const last = panel.lastElementChild!.lastElementChild!;
      return Math.round(panel.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom);
    });
    expect(gap).toBeLessThanOrEqual(4);
    const article = page.locator("article").first();
    await article.getByRole("button", { name: "PMID 18990064", exact: true }).click();
    await expect(article.getByText("randomized controlled trial").first()).toBeVisible();
    await expect(article.getByRole("link", { name: /Open PMID 18990064/ })).toHaveAttribute("href", "https://pubmed.ncbi.nlm.nih.gov/18990064/");
  });

  test("typed wording never pretends to retrieve evidence", async ({ page }) => {
    await page.goto("/intelligence/desk?topic=identity");
    await expect(page.getByText("Fixed evidence.")).toBeVisible();
    await page.getByLabel(/Your own wording/).fill("What do the semaglutide trials show?");
    await expect(page.getByText("This does not search.")).toBeVisible();
    await expect(page.getByText(/names Semaglutide, which has no connected evidence/)).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download source briefing" }).click()]);
    const content = await readFile(await download.path(), "utf8");
    expect(content).toContain("Question coverage: Your wording names Semaglutide");
  });

  test("Sponsor history carries sponsors that the Clinical program does not", async ({ page }) => {
    await page.goto("/intelligence/desk?topic=organizations");
    await expect(page.getByRole("heading", { name: "Sponsors named in these registry records" })).toBeVisible();
    await expect(page.getByText("Dipexium Pharmaceuticals, Inc.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Clinical program/ }).click();
    await expect(page.getByRole("heading", { name: "Sponsors named in these registry records" })).toHaveCount(0);
  });

  test("the dossier hands its lens to the Desk with context preserved", async ({ page }) => {
    await page.goto("/intelligence/explore/pexiganan");
    await page.getByRole("button", { name: "Investigate Registered studies" }).click();
    await page.getByRole("link", { name: "Build a source brief from this" }).click();
    await expect(page).toHaveURL(/\/intelligence\/desk\?topic=clinical-trials/);
    await expect(page.getByRole("heading", { name: /Which pexiganan trials have registered results/ })).toBeVisible();
  });
});

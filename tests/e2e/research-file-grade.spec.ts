import { expect, test } from "@playwright/test";

test.describe("source-reconciled research file grades, not peptide efficacy rankings", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true", "Research-only release");

  test("publishes the exact three-check grading policy and opens every example source", async ({ page }) => {
    const response = await page.goto("/intelligence/grading");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "What have we actually checked?" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Three visible source checks" })).toBeVisible();
    for (const item of ["Molecular reference", "Named registry intervention", "Original experiment"]) {
      await expect(page.getByRole("heading", { name: item, exact: true })).toBeVisible();
    }
    await expect(page.getByText("An A here is not scientifically stronger than a C", { exact: false })).toBeVisible();
    await expect(page.getByRole("region", { name: "Research file grade for Pexiganan" })).toContainText("File coverage A");
    await expect(page.getByRole("region", { name: "Research file grade for Cagrilintide" })).toContainText("File coverage B");
    await expect(page.getByRole("region", { name: "Research file grade for Magainin 2" })).toContainText("File coverage C");
    await expect(page.getByRole("region", { name: "Research file grade for Retatrutide" })).toContainText("No file grade yet");
    await expect(page.getByRole("region", { name: "Research file grade for Pexiganan" })
      .getByRole("link", { name: "Original model-membrane study · PMID 12719236" }))
      .toHaveAttribute("href", "https://pubmed.ncbi.nlm.nih.gov/12719236/");
    await expect(page.getByRole("link", { name: /Cochrane certainty-of-evidence method/ }))
      .toHaveAttribute("href", "https://training.cochrane.org/handbook/current/chapter-14");
    await expect(page.getByRole("button", { name: /Buy|Add to cart|Checkout/i })).toHaveCount(0);
  });

  test("makes file grades visible and filterable without hiding the limits", async ({ page }) => {
    await page.goto("/intelligence/market");
    await expect(page.getByRole("link", { name: "About file coverage" }))
      .toHaveAttribute("href", "/intelligence/grading");
    await page.getByText("More filters", { exact: false }).click();
    const grade = page.getByRole("combobox", { name: "Research file grade filter" });
    await grade.selectOption("A");
    await expect(page.getByRole("status").filter({ hasText: "Showing 1 of 16 compounds" })).toBeVisible();
    await expect(page.locator('[data-testid="research-card"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="research-card"]').first()).toContainText("Pexiganan");
    await expect(page.locator('[data-testid="research-card"]').first()).toContainText("File coverage A");

    await grade.selectOption("B");
    await expect(page.locator('[data-testid="research-card"]')).toHaveCount(3);
    await grade.selectOption("C");
    await expect(page.locator('[data-testid="research-card"]')).toHaveCount(10);
    await grade.selectOption("ungraded");
    await expect(page.locator('[data-testid="research-card"]')).toHaveCount(2);
    await expect(page.locator('[data-testid="research-card"]').first()).toContainText("Retatrutide");
    await grade.selectOption("all");

    await page.getByRole("combobox", { name: "Sort research file coverage" }).selectOption("source-coverage");
    await expect(page.locator('[data-testid="research-card"]').first()).toContainText("Pexiganan");
    await expect(page.getByText("Grades describe VialGrade", { exact: false })).toBeVisible();
  });

  test("reuses the decomposed file grade inside quick-view and a full research dossier", async ({ page }) => {
    await page.goto("/intelligence/market");
    await page.locator('[data-testid="research-card"]').getByRole("button", { name: "Quick view Pexiganan" }).click();
    const quick = page.getByRole("dialog", { name: "Quick research view: Pexiganan" });
    await expect(quick).toContainText("File coverage A");
    await quick.getByText("Why did this research file get that grade?").click();
    await expect(quick.getByRole("region", { name: "Research file grade for Pexiganan" })).toContainText("Specific original experiment");
    await quick.getByRole("link", { name: /Open research dossier/ }).click();
    await expect(page).toHaveURL(/\/intelligence\/explore\/pexiganan$/);
    await page.getByRole("navigation", { name: "Research dossier sections" })
      .getByText("More sections", { exact: false }).click();
    await expect(page.getByRole("navigation", { name: "Research dossier sections" })
      .getByRole("link", { name: "Research file grade" })).toHaveAttribute("href", "#file-grade");
    const full = page.getByRole("region", { name: "Research file grade for Pexiganan" });
    await expect(full).toContainText("3 of 3 source layers individually linked");
    await expect(full.getByRole("link", { name: "Open identity record" }))
      .toHaveAttribute("href", "https://pubchem.ncbi.nlm.nih.gov/compound/16132253");
  });

  test("keeps research grading accessible at mobile width and shopping disabled", async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ["/intelligence/grading", "/intelligence", "/intelligence/explore/retatrutide"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width, path).toBeLessThanOrEqual(391);
    }
    await expect(page.getByRole("region", { name: "Research file grade for Retatrutide" }))
      .toContainText("Molecular identity requires review");
    const response = await request.post("/api/v1/commerce/checkout", { data: {} });
    expect(response.status()).toBe(410);
    const referral = await request.post("/api/partner/conversion", { data: {} });
    expect(referral.status()).toBe(410);
  });
});

import { expect, test } from "@playwright/test";

test.describe("Pexiganan source-centered research workspace", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true", "Public evidence research-only build");

  test("opens with a usable answer and retains the original identity and source navigation", async ({ page }) => {
    await page.goto("/intelligence/explore/pexiganan");
    await expect(page.getByRole("heading", { level: 1, name: "Pexiganan" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Investigate the evidence" }))
      .toHaveAttribute("href", "#research-workspace");
    const workspace = page.getByRole("region", { name: "One compound. Four different evidence questions." });
    await expect(workspace).toBeVisible();
    await expect(workspace.getByRole("heading", { name: "Related molecules are not the same molecule." })).toBeVisible();
    await expect(workspace.getByRole("button", { name: "Investigate Molecular identity" })).toHaveAttribute("aria-pressed", "true");
    await expect(workspace.getByRole("button", { name: "CID 16132253", exact: false })).toHaveAttribute("aria-pressed", "true");
    await expect(workspace.getByRole("link", { name: "Open original record" }))
      .toHaveAttribute("href", "https://pubchem.ncbi.nlm.nih.gov/compound/16132253");
    await workspace.getByRole("button", { name: "CID 16130189", exact: false }).click();
    await expect(workspace.getByRole("link", { name: "Open original record" }))
      .toHaveAttribute("href", "https://pubchem.ncbi.nlm.nih.gov/compound/16130189");
    await expect(page.getByRole("region", { name: "Research file grade for Pexiganan" })).toContainText("3 of 3 source layers");
  });

  test("separates original experiments, source registrations, DERIVED reviews and material evidence", async ({ page }) => {
    await page.goto("/intelligence/explore/pexiganan");
    const workspace = page.getByRole("region", { name: "One compound. Four different evidence questions." });
    await workspace.getByRole("button", { name: "Investigate Original experiments" }).click();
    await expect(workspace.getByRole("heading", { name: "A laboratory membrane model is not a patient outcome." })).toBeVisible();
    await expect(workspace.getByRole("link", { name: "Open original record" }))
      .toHaveAttribute("href", "https://pubmed.ncbi.nlm.nih.gov/12719236/");
    await workspace.getByRole("button", { name: "Investigate Registered studies" }).click();
    await expect(workspace.getByRole("heading", { name: "Four selected registrations. No automatic efficacy verdict." })).toBeVisible();
    await workspace.getByRole("button", { name: "PMID 36781451", exact: false }).click();
    await expect(workspace.getByRole("region", { name: "Selected original source" })).toContainText("Review article");
    await expect(workspace.getByRole("region", { name: "Selected original source" })).toContainText("a review");
    await expect(workspace.getByRole("link", { name: "Open original record" }))
      .toHaveAttribute("href", "https://pubmed.ncbi.nlm.nih.gov/36781451/");
    await workspace.getByRole("button", { name: "Investigate Physical materials" }).click();
    await expect(workspace.getByRole("heading", { name: "No physical lot has been authenticated by VialGrade." })).toBeVisible();
    await expect(workspace.getByRole("link", { name: "Check label and report IDs" }))
      .toHaveAttribute("href", "/intelligence/materials?subject=pexiganan");
    await expect(workspace.getByRole("link", { name: "All six evidence checks" }))
      .toHaveAttribute("href", "/intelligence/passports/pexiganan");
  });

  test("preserves all deeper dossiers and no-sale boundaries in the production-like mode", async ({ page, request }) => {
    await page.goto("/intelligence/explore/pexiganan");
    await expect(page.getByRole("region", { name: "Pexiganan evidence connections" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open guided evidence workpaper" }))
      .toHaveAttribute("href", "/intelligence/cases/magainin-pexiganan");
    await expect(page.getByRole("region", { name: "Pexiganan claim and evidence checks" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Audit this trial" })).toHaveAttribute("href", "/intelligence/studies/NCT01594762");
    for (const path of ["/api/v1/commerce/checkout", "/api/partner/conversion"]) {
      const res = await request.post(path, { data: {} });
      expect(res.status(), path).toBe(410);
    }
  });

  test("is navigable on 360/390px phones and source inspection stays in context", async ({ page }) => {
    for (const width of [360, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/intelligence/explore/pexiganan");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
      const workspace = page.getByRole("region", { name: "One compound. Four different evidence questions." });
      await workspace.getByRole("button", { name: "Investigate Registered studies" }).click();
      await workspace.getByRole("button", { name: "NCT01590758", exact: false }).click();
      await expect(workspace.getByRole("region", { name: "Selected original source" })).toContainText("NCT01590758");
      await expect(workspace.getByRole("link", { name: "Open original record" }))
        .toHaveAttribute("href", "https://clinicaltrials.gov/study/NCT01590758");
    }
  });
});

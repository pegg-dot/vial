import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.describe("source-backed professional research workflows", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true", "Research release only");

  test("makes the Magainin 2 / pexiganan distinction inspectable and exportable", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/intelligence");
    await expect(page.getByRole("link", { name: "Open guided example" }))
      .toHaveAttribute("href", "/intelligence/cases/magainin-pexiganan");
    await page.getByRole("link", { name: "Open guided example" }).click();
    await expect(page).toHaveURL(/\/intelligence\/cases\/magainin-pexiganan$/);
    await expect(page.getByRole("heading", { name: "When related peptides are not the same evidence." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Three things the sources actually establish" })).toBeVisible();
    await expect(page.locator("article").filter({ hasText: "The molecular identities differ" })).toContainText("not prove");
    await expect(page.getByRole("link", { name: /Compare the molecules/ })).toHaveAttribute("href", /subjects=magainin-2%2Cpexiganan/);
    await expect(page.getByRole("link", { name: /Inspect the clinical trial/ })).toHaveAttribute("href", "/intelligence/studies/NCT01594762");
    await page.getByText("Full source register · 5 records").click();
    await expect(page.getByRole("link", { name: "Open original source: Hallock et al. · Biophysical Journal (2003), PMID 12719236" }))
      .toHaveAttribute("href", "https://pubmed.ncbi.nlm.nih.gov/12719236/");
    await expect(page.getByRole("link", { name: "Open original source: Pexiganan clinical study · ClinicalTrials.gov NCT01594762" }))
      .toHaveAttribute("href", "https://clinicaltrials.gov/study/NCT01594762");

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download workpaper" }).click()]);
    expect(download.suggestedFilename()).toBe("vialgrade-magainin-pexiganan-evidence-workpaper.md");
    const txt = await readFile(await download.path(), "utf8");
    expect(txt).toContain("https://pubmed.ncbi.nlm.nih.gov/12719236/");
    expect(txt).toContain("https://clinicaltrials.gov/study/NCT01594762");
    expect(txt).toContain("not independently expert-reviewed");
    expect(txt).toContain("Source limitation:");
    expect(errors).toEqual([]);
  });

  test("keeps molecular identity, selected registered results and paper associations separate", async ({ page }) => {
    await page.goto("/intelligence/explore/cagrilintide");
    const official = page.getByRole("region", { name: "Selected official trial evidence" });
    await expect(official).toBeVisible();
    const verified = official.getByRole("heading", { name: "What the selected trial actually records" });
    const unavailable = official.getByRole("heading", { name: "The selected trial could not be verified." });
    await expect(verified.or(unavailable)).toBeVisible({ timeout: 15000 });
    if (await verified.isVisible()) {
      await expect(official.getByText("No results section returned")).toBeVisible();
      await expect(official.getByText("Registered primary outcome", { exact: false })).toBeVisible();
      await expect(official.getByText("PubMed indexes exact NCT")).toBeVisible();
      await expect(official.getByRole("link", { name: /PMID 39279639/ })).toHaveAttribute("href", "https://pubmed.ncbi.nlm.nih.gov/39279639/");
      const [download] = await Promise.all([page.waitForEvent("download"), official.getByRole("button", { name: "Download brief" }).click()]);
      expect(download.suggestedFilename()).toBe("vialgrade-nct05804162-source-brief.md");
      const text = await readFile(await download.path(), "utf8");
      expect(text).toContain("Registry results section: not-shown");
      expect(text).toContain("exact NCT indexing: confirmed");
    } else {
      await expect(official.getByRole("link", { name: /Open NCT05804162/ }))
        .toHaveAttribute("href", "https://clinicaltrials.gov/study/NCT05804162");
    }
  });

  test("shows registry context on the comparison page without fabricating a clinical winner", async ({ page }) => {
    await page.goto("/intelligence/compare?subjects=retatrutide%2Ctirzepatide&audience=analyst");
    await expect(page.getByRole("heading", { name: "Compare compounds" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Retatrutide selected trial source" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Tirzepatide selected trial source" })).toBeVisible();
    await expect(page.getByText("not a comparative or head-to-head clinical evaluation", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: /Buy|Purchase|Checkout/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Buy|Purchase|Checkout/ })).toHaveCount(0);
  });

  test("links the editorial workpaper from both molecular identities and their comparison", async ({ page }) => {
    for (const slug of ["magainin-2", "pexiganan"]) {
      await page.goto("/intelligence/explore/" + slug);
      await expect(page.getByRole("link", { name: "Open guided evidence workpaper" }))
        .toHaveAttribute("href", "/intelligence/cases/magainin-pexiganan");
    }
    await page.goto("/intelligence/compare?subjects=magainin-2%2Cpexiganan");
    await expect(page.getByRole("link", { name: "Read the source trail" }))
      .toHaveAttribute("href", "/intelligence/cases/magainin-pexiganan");
    await expect(page.getByText("No trial has yet been individually verified", { exact: false })).toBeVisible();
  });

  test("mobile evidence workpaper does not overflow and retired commerce stays denied", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ["/intelligence/cases/magainin-pexiganan", "/intelligence/explore/pexiganan"]) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(391);
    }
    const purchase = await page.request.post("/api/v1/commerce/checkout", { data: {} });
    expect(purchase.status()).toBe(410);
  });
});

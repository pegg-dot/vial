import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.describe("Pexiganan source-first research network", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true", "Research-only release");

  test("connects the research marketplace, a comprehensive dossier, passport, verification and organizations", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", err => errors.push(err.message));
    await page.goto("/intelligence");
    await expect(page.getByRole("link", { name: "Evidence passport" }).first())
      .toHaveAttribute("href", "/intelligence/passports/pexiganan");
    await expect(page.getByRole("link", { name: "Verify source" }).first()).toHaveAttribute("href", "/intelligence/verify");
    await page.getByRole("link", { name: "Open the dossier" }).click();
    await expect(page).toHaveURL(/\/intelligence\/explore\/pexiganan$/);
    await expect(page.getByRole("heading", { level: 1, name: "Pexiganan" })).toBeVisible();
    const wayfinder = page.getByRole("region", { name: "Pexiganan evidence connections" });
    await expect(wayfinder).toBeVisible();
    await expect(wayfinder.getByRole("link", { name: "Read passport" }))
      .toHaveAttribute("href", "/intelligence/passports/pexiganan");
    await expect(wayfinder.getByRole("link", { name: "Try verification" }))
      .toHaveAttribute("href", "/intelligence/verify?ref=PMID%2036781451");
    await expect(wayfinder.getByRole("link", { name: "View source organizations" }))
      .toHaveAttribute("href", "/intelligence/organizations");
    await expect(page.getByRole("navigation", { name: "Research dossier sections" }).getByRole("link", { name: "Trial evidence" }))
      .toHaveAttribute("href", "#pexiganan-trials");
    await wayfinder.getByRole("link", { name: "Read passport" }).click();
    await expect(page.getByRole("heading", { name: "Pexiganan, with the receipts." })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("passport links six claims to original records and exports methodological caveats", async ({ page }) => {
    await page.goto("/intelligence/passports/pexiganan");
    const claims = page.getByRole("region", { name: "Pexiganan claim and evidence checks" });
    await expect(claims.locator("article")).toHaveCount(6);
    await expect(claims.getByRole("heading", { name: "The later DERIVED citation is a review, not a results paper" })).toBeVisible();
    await expect(claims.getByRole("link", { name: /PMID 36781451/ })).toHaveAttribute("href", "https://pubmed.ncbi.nlm.nih.gov/36781451/");
    await expect(claims.getByRole("link", { name: /PMID 18990064/ })).toHaveAttribute("href", "https://pubmed.ncbi.nlm.nih.gov/18990064/");
    await page.getByText("Open the complete original-source register (10 records)").click();
    const register = page.getByRole("region", { name: "Original evidence source register" });
    await expect(register.getByRole("link", { name: "Check source" })).toHaveCount(10);
    await expect(register.getByRole("link", { name: "Check source" }).first())
      .toHaveAttribute("href", /\/intelligence\/verify\?ref=/);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download workpaper" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("vialgrade-pexiganan-evidence-passport.md");
    const markdown = await readFile(await download.path(), "utf8");
    expect(markdown).toContain("NCT00563394");
    expect(markdown).toContain("PMID 36781451");
    expect(markdown).toContain("The later DERIVED citation is a review");
    expect(markdown).toContain("No batch, COA, testing laboratory");
  });

  test("source verifier resolves exact identifiers and fails closed for unknown or misleading inputs", async ({ page }) => {
    await page.goto("/intelligence/verify?ref=PMID%2036781451");
    const verifier = page.getByRole("region", { name: "Original research source verification" });
    await expect(verifier).toContainText("Selected record found in file");
    await expect(verifier).toContainText("review");
    await expect(verifier.getByRole("link", { name: "Open original PubMed record" }))
      .toHaveAttribute("href", "https://pubmed.ncbi.nlm.nih.gov/36781451/");
    await verifier.getByRole("button", { name: "PMID 18990064" }).click();
    await expect(verifier).toContainText("randomized controlled trial");
    await expect(verifier).toContainText("did not supply an exact NCT association");
    await verifier.getByRole("textbox", { name: "Exact NCT, PMID or CID" }).fill("NCT99999999");
    await verifier.getByRole("button", { name: "Check record" }).click();
    await expect(verifier.getByRole("heading", { name: "Not checked in this evidence file" })).toBeVisible();
    await expect(verifier).not.toContainText("Selected record found in file");
    await verifier.getByRole("textbox", { name: "Exact NCT, PMID or CID" }).fill("NCT01594762");
    await verifier.getByRole("button", { name: "Check record" }).click();
    await expect(verifier).toContainText("OneStep-2");
    await expect(verifier.getByRole("link", { name: "Open original ClinicalTrials.gov record" }))
      .toHaveAttribute("href", "https://clinicaltrials.gov/study/NCT01594762");
  });

  test("shows FOUR selected studies with source-status distinction, without claiming a clinical winner", async ({ page }) => {
    await page.goto("/intelligence/passports/pexiganan");
    const trials = page.getByRole("region", { name: "Pexiganan selected original trial records" });
    await expect(trials).toBeVisible({ timeout: 30000 });
    await expect(trials.locator("article")).toHaveCount(4);
    for (const id of ["NCT01594762", "NCT01590758", "NCT00563394", "NCT00563433"]) {
      await expect(trials.getByText(id, { exact: true })).toHaveCount(1);
    }
    await expect(trials).toContainText("different from a publication and from a conclusion about effectiveness");
    await expect(page.getByRole("heading", { name: "No research-material testing verified here" })).toBeVisible();
    await expect(trials.getByRole("link", { name: "Verify this NCT" }).or(
      trials.getByRole("link", { name: "Open original registry" })
    ).first()).toBeVisible();
  });

  test("organization directory reports named sponsors and explicitly refuses lab/vendor certification", async ({ page }) => {
    await page.goto("/intelligence/organizations");
    await expect(page.getByRole("heading", { level: 1, name: "Who is behind these records?" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dipexium Pharmaceuticals, Inc." })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("heading", { name: "Abeona Therapeutics, Inc" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open source NCT00563394" }))
      .toHaveAttribute("href", "https://clinicaltrials.gov/study/NCT00563394");
    await expect(page.locator("main")).toContainText("not current corporate ownership");
    await expect(page.getByRole("heading", { name: "No research-material testing verified here" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Buy|Purchase|Checkout/ })).toHaveCount(0);
  });

  test("keeps public source network mobile friendly and denies retired purchasing", async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of [
      "/intelligence", "/intelligence/explore/pexiganan",
      "/intelligence/passports/pexiganan", "/intelligence/verify?ref=PMID%2036781451",
      "/intelligence/organizations",
    ]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(391);
    }
    for (const path of ["/api/v1/commerce/checkout", "/api/v1/commerce/cart", "/api/partner/conversion"]) {
      expect((await request.post(path, { data: {} })).status(), path).toBe(410);
    }
  });
});

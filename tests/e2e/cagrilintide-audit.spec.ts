import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test.describe("source-based research task prototype", () => {
  test("links a single deliberately selected study audit from the research dossier", async ({ page }) => {
    await page.goto("/intelligence/cagrilintide");
    const audit = page.getByRole("link", { name: "Open study audit" });
    await expect(audit).toBeVisible();
    await audit.click();
    await expect(page).toHaveURL(/\/intelligence\/cagrilintide\/audit$/);
    await expect(page.getByRole("heading", {
      name: "Did this clinical trial publish any findings?",
    })).toBeVisible();
    await expect(page.getByText("This is a worked example with four selected records", { exact: false })).toBeVisible();
  });

  test("compares pinned source IDs with cautious availability, outcomes and no sales", async ({ page }) => {
    const clientErrors: string[] = [];
    page.on("pageerror", error => clientErrors.push(error.message));
    await page.goto("/intelligence/cagrilintide/audit");
    for (const id of ["NCT03856047", "NCT04982575", "NCT05804162", "NCT07564414"]) {
      await expect(page.locator("article span.font-mono").filter({ hasText: id })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "What the records flag for follow-up" })).toBeVisible();
    // The sponsor-backed identity check appears only if the official trial
    // source was available and its intervention names match the scoped case.
    // Additional source-audited checks may be collapsed; count an actual
    // DOM href rather than a currently visible accessibility-tree element.
    const sponsorReference = page.locator('a[href*="novonordisk.com"]');
    if (await sponsorReference.count()) {
      await expect(sponsorReference).toHaveAttribute("href", /novonordisk\.com/);
    } else {
      await expect(page.getByText("source(s) unavailable", { exact: false })).toBeVisible();
    }
    const firstDetail = page.locator("article details").first();
    expect(await firstDetail.evaluate(el => (el as HTMLDetailsElement).open)).toBe(false);
    await firstDetail.locator("summary").click();
    await expect(firstDetail.getByRole("heading", { name: "Interventions actually named" })).toBeVisible();
    await expect(firstDetail.getByRole("heading", { name: "Primary outcomes registered" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Study-design audit" })).toBeVisible();
    const additionalChecks = page.locator("details").filter({ has: page.locator("summary").filter({ hasText: "additional study-design checks" }) });
    if (await additionalChecks.count()) {
      expect(await additionalChecks.evaluate(el => (el as HTMLDetailsElement).open)).toBe(false);
      await additionalChecks.locator("summary").click();
      await expect(additionalChecks).toHaveAttribute("open", "");
    }
    await expect(page.getByRole("heading", { name: "Questions the current evidence cannot answer" })).toBeVisible();
    await expect(page.getByText("No two verified historical versions", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: "Market", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Buy|Checkout/i })).toHaveCount(0);
    expect(clientErrors).toEqual([]);
  });

  test("separates registry result sections from PubMed-linked citations and keeps original reference tags", async ({ page }) => {
    await page.goto("/intelligence/cagrilintide/audit");
    // This audit is source-dependent and is explicitly designed to degrade if
    // a primary provider is unavailable, not display invented paper claims.
    const studyRows = page.locator("article").filter({ has: page.locator("span.font-mono") });
    await expect(studyRows).toHaveCount(4);
    const qtStudy = studyRows.filter({ hasText: "NCT05804162" });
    const missingSource = qtStudy.getByRole("heading", { name: "Official record unavailable" });
    if (await missingSource.count()) {
      await expect(missingSource).toBeVisible();
    } else {
      await expect(qtStudy.getByRole("heading", { name: "Publication evidence linked to this study" })).toBeVisible();
      const pmid = qtStudy.getByText("PMID 39279639", { exact: true });
      if (await pmid.count()) {
        await expect(pmid).toBeVisible();
        await expect(qtStudy.getByText("Registry label: RESULT", { exact: true })).toBeVisible();
        await expect(qtStudy.getByRole("link", { name: "Read PubMed record" })).toHaveAttribute("href", "https://pubmed.ncbi.nlm.nih.gov/39279639/");
      } else {
        await expect(qtStudy.getByText("No PMID is listed in the protocol reference fields", { exact: false })).toBeVisible();
      }
    }
  });

  test("exports a reproducible factual source register without account or tracking", async ({ page }) => {
    await page.goto("/intelligence/cagrilintide/audit");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export cited Markdown" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("vialgrade-cagrilintide-study-audit.md");
    const content = await readFile(await download.path(), "utf8");
    expect(content).toContain("Cagrilintide");
    expect(content).toContain("NCT03856047");
    expect(content).toContain("NCT07564414");
    expect(content).toContain("No earlier version baseline");
    expect(content).toContain("not the upstream retrieval time");
    expect(content).toContain("Routine hosting/security logs may still record visits");
  });

  test("shows the research 404 rather than a login prompt for unavailable study audits", async ({ page }) => {
    const response = await page.goto("/intelligence/retatrutide/audit");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "There is no research page at this address." })).toBeVisible();
    await expect(page.getByRole("link", { name: "View study audit" })).toHaveAttribute("href", "/intelligence/cagrilintide/audit");
  });
});

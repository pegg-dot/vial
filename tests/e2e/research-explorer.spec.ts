import { expect, test } from "@playwright/test";
import { RESEARCH_SUBJECTS } from "../../src/lib/research-explorer";

test.describe("Research Explorer discovery experience", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true", "Research-only public discovery release");
  test("provides browsing, scientific theme filters and alias search without a sales funnel", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/intelligence/market");
    await expect(page.getByRole("heading", { name: /The research,/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Compounds" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Showing 16 of 16 compounds" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open research dossier: Pexiganan" })).toHaveAttribute("href", "/intelligence/explore/pexiganan");

    await page.getByRole("button", { name: /Host defense & antimicrobials/ }).click();
    await expect(page.getByRole("status").filter({ hasText: "Showing 4 of 16 compounds" })).toBeVisible();
    await expect(page.locator('[data-testid="research-card"]').getByRole("heading", { name: "Pexiganan", exact: true })).toBeVisible();
    await expect(page.locator('[data-testid="research-card"]').getByRole("heading", { name: "Semaglutide", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Clear filters" }).click();

    const search = page.getByRole("searchbox", { name: "Search research subjects" });
    await search.fill("LY3437943");
    await expect(page.getByRole("status").filter({ hasText: "Showing 1 of 16 compounds" })).toBeVisible();
    await expect(page.locator('[data-testid="research-card"]').getByRole("heading", { name: "Retatrutide", exact: true })).toBeVisible();
    await search.fill("nonexistent-chemical-name");
    await expect(page.getByRole("heading", { name: "No matching compounds" })).toBeVisible();
    await page.getByRole("button", { name: "Show all records" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Showing 16 of 16 compounds" })).toBeVisible();
    await expect(page.locator('[data-testid="research-card"]')).toHaveCount(16);
    await expect(page.getByRole("link", { name: /Buy|Checkout|Seller|Shop/i })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("can build a real two-subject comparison from the cards in either research perspective", async ({ page }) => {
    await page.goto("/intelligence/market");
    await page.getByText("More filters", { exact: false }).click();
    await page.getByRole("button", { name: "Analyst", exact: true }).click();
    await expect(page.getByRole("button", { name: "Analyst", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("searchbox", { name: "Search research subjects" }).fill("tirzepatide");
    await page.getByRole("button", { name: "Compare Tirzepatide" }).click();
    await expect(page.getByRole("region", { name: "Comparison selection" })).toBeVisible();
    await page.getByRole("searchbox", { name: "Search research subjects" }).fill("retatrutide");
    await page.getByRole("button", { name: "Compare Retatrutide" }).click();

    await expect(page.getByRole("link", { name: "Compare subjects" })).toHaveAttribute(
      "href", "/intelligence/compare?subjects=tirzepatide%2Cretatrutide&audience=analyst",
    );
    await page.getByRole("link", { name: "Compare subjects" }).click();
    await expect(page).toHaveURL(/\/intelligence\/compare\?/);
    await expect(page.getByRole("heading", { name: "Compare compounds" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tirzepatide", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Retatrutide", exact: true })).toBeVisible();
    await expect(page.getByText("PubChem reference · SID 528343961 (no CID)")).toBeVisible();
    await expect(page.getByRole("link", { name: "Analyst" })).toHaveAttribute("aria-current", "page");
    await page.getByRole("link", { name: "Researcher" }).click();
    await expect(page.getByRole("link", { name: "Researcher" })).toHaveAttribute("aria-current", "page");
  });

  test("opens a truthful dossier with verified identity and carefully labeled source searches", async ({ page }) => {
    await page.goto("/intelligence/explore/cagrilintide");
    await expect(page.getByRole("heading", { name: "Cagrilintide", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Follow the source trail" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What still needs checking" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Inspect molecular identity" }))
      .toHaveAttribute("href", "https://pubchem.ncbi.nlm.nih.gov/compound/171397054");
    await expect(page.getByRole("link", { name: "Audit this trial" }))
      .toHaveAttribute("href", "/intelligence/studies/NCT05804162");
    await expect(page.getByRole("link", { name: "Search PubMed" }))
      .toHaveAttribute("href", /pubmed\.ncbi\.nlm\.nih\.gov\/\?term=/);
    await page.getByRole("button", { name: "Analyst", exact: true }).click();
    await expect(page.getByRole("button", { name: "Analyst", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Avoid merging", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: /Buy|Shop|Get quote|Request supply|Checkout/i })).toHaveCount(0);
  });

  test("renders every curated subject and fails closed on invalid slugs", async ({ request }) => {
    for (const subject of RESEARCH_SUBJECTS) {
      const result = await request.get("/intelligence/explore/" + subject.slug);
      expect(result.status(), subject.slug).toBe(200);
      expect(await result.text(), subject.slug).toContain(subject.name);
    }
    for (const invalid of ["unknown-molecule", "constructor", "__proto__"]) {
      const response = await request.get("/intelligence/explore/" + invalid, { maxRedirects: 0 });
      expect([307, 404], invalid + " must never show another subject").toContain(response.status());
    }
    const privateChild = await request.get("/intelligence/explore/semaglutide/admin", { maxRedirects: 0 });
    expect(privateChild.status()).toBe(307);
  });

  test("keeps all browsing and comparison pages within phone width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ["/intelligence", "/intelligence/explore/retatrutide", "/intelligence/compare?subjects=retatrutide%2Ctirzepatide&audience=analyst"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width, "horizontal overflow " + path).toBeLessThanOrEqual(391);
    }
  });

  test("retains the server-side hard block for every purchase and referral path", async ({ request }) => {
    for (const path of ["/api/v1/commerce/checkout", "/api/v1/commerce/cart", "/go/any-seller", "/api/partner/conversion"]) {
      const response = await request.post(path, { data: {}, maxRedirects: 0 });
      expect(response.status(), path).toBe(410);
    }
    const market = await request.get("/market", { maxRedirects: 0 });
    expect(market.status()).toBe(307);
  });
});

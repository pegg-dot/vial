import { expect, test } from "@playwright/test";

test.describe("research UX comprehension without deleting tools", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true", "Research-only preview");

  test("home distinguishes three starting inputs and scopes the limited verifier", async ({ page }) => {
    await page.goto("/intelligence");
    await expect(page.getByRole("heading", { level: 1, name: /Know what.s behind the claim/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Check an exact source ID in the Pexiganan pilot" }))
      .toHaveAttribute("href", "/intelligence/verify");
    await expect(page.getByText(/Source ID checking currently covers selected Pexiganan records/)).toBeVisible();
    const startingPoints = page.getByRole("group", { name: "Choose a research starting point" });
    await expect(startingPoints.getByRole("link", { name: "a compound" }))
      .toHaveAttribute("href", "/intelligence/market#browse");
    await expect(startingPoints.getByRole("link", { name: "a trial ID" }))
      .toHaveAttribute("href", "/intelligence#trial-lookup");
    await expect(startingPoints.getByRole("link", { name: "a research question" }))
      .toHaveAttribute("href", "/intelligence/desk");
  });

  test("desktop nav separates original source, sponsors, and supplier claims", async ({ page }) => {
    await page.goto("/intelligence/market");
    const nav = page.getByRole("navigation", { name: "Research navigation" });
    await expect(nav.getByRole("link", { name: "Market" }))
      .toHaveAttribute("href", "/intelligence/market");
    await expect(nav.getByRole("link", { name: "Check a source" }))
      .toHaveAttribute("href", "/intelligence/verify");
    await nav.getByText("More research", { exact: false }).click();
    const more = page.getByRole("navigation", { name: "More research areas" });
    await expect(more.getByRole("link", { name: /Study sponsors/ }))
      .toHaveAttribute("href", "/intelligence/organizations");
    await expect(more.getByRole("link", { name: /Supplier documentation/ }))
      .toHaveAttribute("href", "/intelligence/providers");
    await expect(more.getByRole("link", { name: /Sample report checks/ }))
      .toHaveAttribute("href", "/intelligence/materials");
    await expect(more.getByRole("link", { name: /All compounds/ }))
      .toHaveAttribute("href", "/intelligence/market#browse");
    await expect(page.getByRole("heading", { name: /The research,/ })).toBeVisible();
    await expect(page.locator('[data-testid="research-card"]')).toHaveCount(16);
    await expect(page.getByRole("heading", { name: "Studies on file" })).toBeVisible();
  });

  test("dossier leads with answers and still exposes all technical sections", async ({ page }) => {
    await page.goto("/intelligence/explore/pexiganan");
    await expect(page.getByRole("link", { name: "Investigate the evidence" })).toHaveAttribute("href", "#research-workspace");
    await expect(page.getByRole("link", { name: "Inspect molecular identity" })).toHaveAttribute("href", "https://pubchem.ncbi.nlm.nih.gov/compound/16132253");
    await expect(page.getByText("This letter describes linked source types", { exact: false })).toBeVisible();
    await expect(page.getByText("What is this?")).toBeVisible();
    await expect(page.getByText("What is linked?")).toBeVisible();
    await expect(page.getByText("What is not verified?")).toBeVisible();
    const technical = page.locator("details").filter({ has: page.getByText("Molecular and technical details") });
    await expect(technical).not.toHaveAttribute("open", "");
    await technical.locator("summary").click();
    await expect(technical.getByText("Membrane-associated antimicrobial peptide activity")).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Research dossier sections" });
    await expect(nav.getByRole("link", { name: "Original sources" })).toHaveAttribute("href", "#sources");
    await nav.getByText("More sections", { exact: false }).click();
    for (const [label, hash] of [
      ["Research file grade", "#file-grade"], ["Material verification", "#material-evidence"],
      ["Evidence network", "#pexiganan-network"], ["Related research", "#related"],
    ]) {
      await expect(nav.getByRole("link", { name: label })).toHaveAttribute("href", hash);
    }
    await expect(page.getByRole("region", { name: "Research file grade for Pexiganan" })).toContainText("3 of 3 source layers");
    await expect(page.getByRole("link", { name: "Open guided evidence workpaper" }))
      .toHaveAttribute("href", "/intelligence/cases/magainin-pexiganan");
  });

  test("material workflow puts typed lot comparison first, preserves complete identity index", async ({ page, request }) => {
    await page.goto("/intelligence/materials?subject=pexiganan");
    const work = page.getByRole("heading", { name: "Pexiganan material file" });
    await expect(work).toBeVisible();
    const positions = await page.evaluate(() => ({
      form: document.getElementById("material-workpaper")?.getBoundingClientRect().top,
      index: document.getElementById("material-index")?.getBoundingClientRect().top,
    }));
    expect(positions.form ?? Infinity).toBeLessThan(positions.index ?? -Infinity);
    await expect(page.locator("#material-index")).not.toHaveAttribute("open", "");
    await page.getByPlaceholder("Exact ID from the label").fill("ABC-15");
    await page.getByPlaceholder("Exact ID from the report").fill("ABC-15");
    await expect(page.getByRole("status")).toContainText("Authenticity still unverified");
    await page.getByRole("button", { name: "Choose another compound" }).click();
    await expect(page.locator("#material-index")).toHaveAttribute("open", "");
    const chooser = page.getByRole("region", { name: "Research material identity index" });
    await expect(chooser.getByRole("button", { name: "Review Semaglutide material evidence" })).toBeVisible();
    await chooser.getByRole("button", { name: "Review Semaglutide material evidence" }).click();
    await expect(page.getByRole("heading", { name: "Semaglutide material file" })).toBeVisible();
    await expect(page.getByPlaceholder("Exact ID from the label")).toHaveValue("");
    expect((await request.post("/api/v1/commerce/checkout", { data: {} })).status()).toBe(410);
  });

  test("source pages explain limits while retaining the original evidence", async ({ page }) => {
    await page.goto("/intelligence/verify");
    await expect(page.getByText("Exact source ID lookup · Pexiganan pilot")).toBeVisible();
    await expect(page.getByText("This is a limited pilot, not a general claim checker", { exact: false })).toBeVisible();
    await expect(page.getByRole("textbox").first()).toBeVisible();
    await page.goto("/intelligence/passports/pexiganan");
    await expect(page.getByRole("heading", { name: "What can we actually say?" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Pexiganan claim and evidence checks" })).toBeVisible();
    await page.goto("/intelligence/organizations");
    await expect(page.getByRole("heading", { level: 1, name: "Who sponsored the selected studies?" })).toBeVisible();
    await page.goto("/intelligence/providers");
    await expect(page.getByRole("heading", { level: 1, name: "Supplier quality documents" })).toBeVisible();
  });

  test("a mobile reader can find all functions in a single scrollable navigation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/intelligence");
    await page.getByRole("button", { name: "Open menu" }).click();
    const menu = page.getByRole("navigation", { name: "Mobile research links" });
    for (const [label, href] of [
      ["Market", "/intelligence/market"],
      ["Compounds", "/intelligence/market#browse"],
      ["Verify", "/intelligence/verify"],
      ["Study sponsors", "/intelligence/organizations"],
      ["Supplier documents", "/intelligence/providers"],
      ["Sample report checks", "/intelligence/materials"],
    ]) {
      await expect(menu.getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
    await menu.getByRole("link", { name: "Market" }).click();
    await expect(page).toHaveURL(/\/intelligence\/market$/);
    for (const route of ["/intelligence/explore/pexiganan", "/intelligence/passports/pexiganan", "/intelligence/materials"]) {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), route).toBeLessThanOrEqual(391);
    }
  });
});

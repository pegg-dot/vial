import { expect, test } from "@playwright/test";

test.describe("research UX comprehension without deleting tools", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true", "Research-only preview");

  test("home distinguishes three starting inputs and scopes the limited verifier", async ({ page }) => {
    await page.goto("/intelligence");
    await expect(page.getByRole("heading", { level: 1, name: /Know what.s behind the claim/ })).toBeVisible();
    await expect(page.getByRole("search", { name: "Check an exact source ID" })).toBeVisible();
    await expect(page.getByText(/looked up live\. PubMed and PubChem IDs are checked against the selected Pexiganan records only/)).toBeVisible();
    const startingPoints = page.getByRole("group", { name: "Choose a research starting point" });
    await expect(startingPoints.getByRole("link", { name: "a compound" }))
      .toHaveAttribute("href", "/compounds#browse");
    await expect(startingPoints.getByRole("link", { name: "a trial ID" }))
      .toHaveAttribute("href", "/intelligence#trial-lookup");
    await expect(startingPoints.getByRole("link", { name: "a research question" }))
      .toHaveAttribute("href", "/intelligence/desk");
  });

  test("desktop nav: the directories, then four research tools", async ({ page }) => {
    await page.goto("/compounds");
    const nav = page.getByRole("navigation", { name: "Research navigation" });
    await expect(nav.getByRole("link", { name: "Compounds", exact: true }))
      .toHaveAttribute("href", "/compounds");
    await expect(nav.getByRole("link", { name: "How we check", exact: true }))
      .toHaveAttribute("href", "/how-we-check");
    await nav.locator("summary", { hasText: "Research tools" }).click();
    const tools = nav.getByRole("navigation", { name: "Research tools" });
    await expect(tools.getByRole("link", { name: /Check a source/ }))
      .toHaveAttribute("href", "/intelligence/verify");
    await expect(tools.getByRole("link", { name: /Material checks/ }))
      .toHaveAttribute("href", "/intelligence/materials");
    // Sponsors live on the pexiganan page and supplier documents inside Material checks: not menu items.
    await expect(tools.getByRole("link", { name: /Study sponsors|Supplier documentation|Sample report checks|Open a trial ID/ })).toHaveCount(0);
    await expect(page.getByRole("banner").getByRole("link", { name: "Compare", exact: true })).toHaveCount(0);
    // "All compounds" is the library itself now: the hero's first action lands on the explorer.
    await expect(page.getByRole("link", { name: "Browse the research library" })).toHaveAttribute("href", "#browse");
    await expect(page.getByRole("heading", { level: 1, name: /Every peptide we track/ })).toBeVisible();
    await expect(page.locator('[data-testid="research-card"]')).toHaveCount(16);
    await expect(page.getByRole("heading", { name: "Studies on file" })).toBeVisible();
  });

  // One navigation. The header, the mobile menu and the footer draw from the same two lists: the
  // directories (vendors, labs and batch records only under the browse release) and the research
  // tools in one menu. The old "Market" / "More research" / "Browse the directory" menus are gone.
  test("header, footer and mobile menu share one directory list and one research-tools list", async ({ page }) => {
    const browse = process.env.VIALGRADE_PUBLIC_BROWSE === "true";
    const directories: [string, string][] = [
      ["Compounds", "/compounds"],
      ...(browse ? [["Vendors", "/vendors"], ["Labs", "/labs"], ["Batch records", "/passports"]] as [string, string][] : []),
      ["How we check", "/how-we-check"],
    ];
    // Four tools (doc §10). The monthly update is a footer link only.
    const tools: [string, string][] = [
      ["Research Desk", "/intelligence/desk"],
      ["Check a source", "/intelligence/verify"],
      ["Compare compounds", "/intelligence/compare?subjects=magainin-2%2Cpexiganan"],
      ["Material checks", "/intelligence/materials"],
    ];
    const gone = ["Market", "More research", "Other research tools", "More research areas", "Browse the directory", "Verify research",
      "Open a trial ID", "Sample report checks", "Study sponsors", "Supplier documentation", "Purity vs grade", "Monthly update"];

    await page.goto("/intelligence");
    const nav = page.getByRole("navigation", { name: "Research navigation" });
    // The directory links are the nav's own children, in order; the tools sit behind one summary.
    await expect(nav.locator(":scope > a")).toHaveText(directories.map(([label]) => label));
    for (const [label, href] of directories) await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute("href", href);
    if (!browse) for (const label of ["Vendors", "Labs", "Batch records"]) await expect(nav.getByRole("link", { name: label, exact: true })).toHaveCount(0);
    await expect(nav.locator("summary")).toHaveCount(1);
    await expect(nav.locator("summary")).toContainText("Research tools");
    // A closed <details> hides its menu from the accessibility tree; open it before counting.
    await nav.locator("summary").click();
    const headerTools = nav.getByRole("navigation", { name: "Research tools" });
    await expect(headerTools.getByRole("link")).toHaveCount(tools.length);
    for (const [label, href] of tools) {
      const link = headerTools.getByRole("link", { name: label });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", href);
    }
    for (const label of gone) await expect(nav.getByText(label, { exact: true })).toHaveCount(0);

    const footerDirectories = page.getByRole("navigation", { name: "Explore research" });
    await expect(footerDirectories.getByRole("link")).toHaveText(directories.map(([label]) => label));
    for (const [label, href] of directories) await expect(footerDirectories.getByRole("link", { name: label, exact: true })).toHaveAttribute("href", href);
    const footerTools = page.getByRole("navigation", { name: "Research tools" }).last();
    await expect(footerTools.getByRole("link")).toHaveText([...tools.map(([label]) => label), "Monthly update"]);
    for (const [label, href] of [...tools, ["Monthly update", "/intelligence/updates"]]) await expect(footerTools.getByRole("link", { name: label, exact: true })).toHaveAttribute("href", href);
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Read the methodology" })).toHaveAttribute("href", "/how-we-check");
    await expect(page.getByRole("navigation", { name: "How we check" })).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Open menu" }).click();
    const menu = page.getByRole("navigation", { name: "Mobile research links" });
    await expect(menu.getByText("Directories", { exact: true })).toBeVisible();
    await expect(menu.getByText("Research tools", { exact: true })).toBeVisible();
    for (const [label, href] of [...directories, ...tools]) await expect(menu.getByRole("link", { name: label, exact: true })).toHaveAttribute("href", href);
    await expect(menu.getByRole("link")).toHaveCount(directories.length + tools.length + 2); // + Home, + Existing account
    for (const label of [...gone, "Start with", "Dig deeper", "Verify"]) await expect(menu.getByText(label, { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Close menu" }).click();
    await expect(menu).toHaveCount(0);
  });

  test("dossier leads with answers and still exposes all technical sections", async ({ page }) => {
    await page.goto("/compounds/pexiganan");
    await expect(page.getByRole("link", { name: "Investigate the evidence" })).toHaveAttribute("href", "#research-workspace");
    await expect(page.getByRole("link", { name: "Inspect molecular identity" })).toHaveAttribute("href", "https://pubchem.ncbi.nlm.nih.gov/compound/16132253");
    await expect(page.getByText("This letter describes linked source types", { exact: false })).toBeVisible();
    await expect(page.getByText("What is this?")).toBeVisible();
    await expect(page.getByText("What is linked?")).toBeVisible();
    await expect(page.getByText("What is not verified?")).toBeVisible();
    // Technical details are part of the Overview now, not hidden behind a disclosure.
    await expect(page.locator("#overview").getByText("Membrane-associated antimicrobial peptide activity").first()).toBeVisible();
    const nav = page.getByRole("navigation", { name: "On this page" });
    for (const [label, hash] of [
      ["Overview", "#overview"], ["Source file", "#file-grade"], ["Studies", "#studies"],
      ["Sources", "#sources"], ["Materials", "#material-evidence"], ["Limits and related", "#related"],
    ]) {
      await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute("href", hash);
    }
    await expect(page.locator("#pexiganan-network")).toHaveCount(1);
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
    await page.goto("/compounds/pexiganan#studies");
    await expect(page.getByRole("heading", { name: "What can we actually say?" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Pexiganan claim and evidence checks" })).toBeVisible();
    // The sponsor page and the supplier-documentation index forward to where their content lives.
    for (const [from, to] of [["/intelligence/organizations", "/compounds/pexiganan#organizations"], ["/intelligence/providers", "/intelligence/materials#material-providers"]]) {
      const hop = await page.request.get(from, { maxRedirects: 0 });
      expect(hop.status(), from).toBe(308);
      expect(hop.headers().location, from).toBe(to);
    }
    await page.goto("/intelligence/materials#material-providers");
    await expect(page.getByRole("heading", { name: "Who publishes the quality information?" })).toBeInViewport();
  });

  test("a mobile reader can find all functions in a single scrollable navigation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/intelligence");
    await page.getByRole("button", { name: "Open menu" }).click();
    const menu = page.getByRole("navigation", { name: "Mobile research links" });
    for (const [label, href] of [
      ["Compounds", "/compounds"],
      ["How we check", "/how-we-check"],
      ["Check a source", "/intelligence/verify"],
      ["Material checks", "/intelligence/materials"],
    ]) {
      await expect(menu.getByRole("link", { name: label, exact: true })).toHaveAttribute("href", href);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
    await menu.getByRole("link", { name: "Compounds", exact: true }).click();
    await expect(page).toHaveURL(/\/compounds$/);
    for (const route of ["/compounds/pexiganan", "/how-we-check", "/intelligence/materials"]) {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), route).toBeLessThanOrEqual(391);
    }
  });
});

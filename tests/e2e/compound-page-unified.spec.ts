import { expect, test } from "@playwright/test";

// One page per compound. A research file (pexiganan) and a catalog record (bpc-157) share one
// route; the old dossier address forwards. Under the evidence-only release a page with a research
// file is public whether or not the browse release is on; the catalog parts need the browse release.
test.describe("One page per compound", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true", "Research-only preview");
  const browse = process.env.VIALGRADE_PUBLIC_BROWSE === "true";

  test("the dossier address forwards permanently to the compound page, keeping the hash", async ({ page, request }) => {
    const hop = await request.get("/intelligence/explore/pexiganan", { maxRedirects: 0 });
    expect(hop.status()).toBe(308);
    expect(hop.headers().location).toBe("/compounds/pexiganan");
    await page.goto("/intelligence/explore/pexiganan#studies");
    await expect(page).toHaveURL(/\/compounds\/pexiganan#studies$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Pexiganan");
  });

  // Converge C: one directory, one method page, one source checker, and the passport folded into
  // the pexiganan page. Each retired address forwards permanently, keeping what the reader asked for.
  test("the retired research addresses forward permanently, keeping query string and hash", async ({ page, request }) => {
    for (const [from, to] of [
      ["/intelligence/market", "/compounds"],
      ["/intelligence/market?theme=host-defense", "/compounds?theme=host-defense"],
      ["/intelligence/market?theme=host-defense&sort=source-coverage", "/compounds?theme=host-defense&sort=source-coverage"],
      ["/intelligence/grading", "/how-we-check#grade-checks"],
      ["/intelligence/passports/pexiganan", "/compounds/pexiganan#studies"],
    ]) {
      const hop = await request.get(from, { maxRedirects: 0 });
      expect(hop.status(), from).toBe(308);
      expect(hop.headers().location, from).toBe(to);
      // The Location header itself carries the section hash: the reader lands on the letters, or on
      // the Studies section, not at the top of a long page.
      const landing = new URL(hop.headers().location!, "http://localhost");
      expect(landing.hash, from + " keeps its hash").toBe(new URL(to, "http://localhost").hash);
    }
    expect(new URL((await request.get("/intelligence/grading", { maxRedirects: 0 })).headers().location!, "http://localhost").hash).toBe("#grade-checks");
    expect(new URL((await request.get("/intelligence/passports/pexiganan", { maxRedirects: 0 })).headers().location!, "http://localhost").hash).toBe("#studies");
    // /verify forwards 308 to /intelligence/verify from its page, but under the evidence-only release
    // the proxy treats /verify as a retired shop surface and answers first with the retired notice.
    // follow-and-news.spec.ts proves the 308 without the gate. Pinned here so the gap stays visible.
    const verify = await request.get("/verify", { maxRedirects: 0 });
    expect(verify.status()).toBe(307);
    expect(verify.headers().location).toBe("/intelligence?notice=retired");

    // A browser keeps the fragment when the Location carries none, and takes the Location's own one.
    await page.goto("/intelligence/market?theme=host-defense#browse");
    await expect(page).toHaveURL(/\/compounds\?theme=host-defense#browse$/);
    await expect(page.getByRole("status").filter({ hasText: "Showing 4 of 16 compounds" })).toBeVisible();
    await page.goto("/intelligence/grading");
    await expect(page).toHaveURL(/\/how-we-check#grade-checks$/);
    await expect(page.getByRole("heading", { name: "Three visible source checks" })).toBeInViewport();
    await page.goto("/intelligence/passports/pexiganan");
    await expect(page).toHaveURL(/\/compounds\/pexiganan#studies$/);
    await expect(page.getByRole("heading", { name: "What can we actually say?" })).toBeInViewport();
  });

  test("the research library and the method page are public whatever the browse release says", async ({ page, request }) => {
    for (const [path, h1] of [["/compounds", /Every peptide we track/], ["/how-we-check", /Trust is a chain of evidence/]] as const) {
      expect((await request.get(path, { maxRedirects: 0 })).status(), path).toBe(200);
      expect((await request.head(path, { maxRedirects: 0 })).status(), "HEAD " + path).toBe(200);
      expect((await request.post(path, { data: {}, maxRedirects: 0 })).status(), "POST " + path).toBe(410);
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: h1 })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/intelligence");
    }
    // /compounds: the library is always there; the catalog records only under the browse release.
    await page.goto("/compounds");
    await expect(page.getByRole("link", { name: "Browse the research library" })).toHaveAttribute("href", "#browse");
    await expect(page.locator("#browse").getByRole("heading", { name: "Browse everything." })).toBeVisible();
    await expect(page.locator('[data-testid="research-card"]')).toHaveCount(16);
    await expect(page.getByRole("link", { name: "Catalog records" })).toHaveCount(browse ? 1 : 0);
    await expect(page.locator("#catalog")).toHaveCount(browse ? 1 : 0);
    if (browse) {
      await expect(page.locator("#catalog").getByRole("heading", { name: "Lab evidence and batch records on file." })).toBeVisible();
      await expect(page.locator("#catalog").getByRole("heading", { name: "Every record, by shelf" })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: /on one screen/i })).toHaveCount(0);
    // /how-we-check: the research-file letters are one section of the method, before "Go deeper".
    await page.goto("/how-we-check");
    const files = page.locator("#research-files");
    await expect(files.getByRole("heading", { name: "What have we actually checked?" })).toBeVisible();
    for (const [id, title] of [["grade-checks", "Three visible source checks"], ["grade-examples", "Four examples with the checks exposed"], ["grade-limits", "Why this is not a scientific certainty grade"]]) {
      await expect(files.locator("#" + id).getByRole("heading", { name: title })).toBeVisible();
    }
    for (const name of ["Pexiganan", "Cagrilintide", "Magainin 2", "Retatrutide"]) {
      await expect(files.getByRole("link", { name: name + " research file" })).toHaveAttribute("href", "/compounds/" + name.toLowerCase().replace(" ", "-"));
    }
    const order = await page.evaluate(() => ["research-files", "grade-checks", "grade-examples", "grade-limits"].map(id => document.getElementById(id)!.getBoundingClientRect().top));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const goDeeper = await page.getByRole("heading", { name: "The full records, if you want them" }).evaluate(el => el.getBoundingClientRect().top);
    expect(order[0]).toBeLessThan(goDeeper);
  });

  test("the pexiganan passport is the Studies section: plain answer, six checks, the live registry", async ({ page, request }) => {
    await page.goto("/compounds/pexiganan");
    const studies = page.locator("main section#studies");
    const summary = studies.getByRole("region", { name: "Passport summary in plain language" });
    await expect(summary.getByRole("heading", { name: "What can we actually say?" })).toBeVisible();
    await expect(summary.getByText("The bottom line")).toBeVisible();
    await expect(summary.getByText("Save the source trail")).toBeVisible();
    await expect(summary.getByRole("button", { name: "Download workpaper" })).toBeVisible();
    const claims = studies.locator("#passport-claims");
    await expect(claims.getByRole("heading", { name: "Six observations, each tied to its original record" })).toBeVisible();
    const grid = claims.getByRole("region", { name: "Pexiganan claim and evidence checks" });
    await expect(grid.locator("article[id^='evidence-claim-']")).toHaveCount(6);
    const registry = studies.locator("#passport-studies");
    await expect(registry.getByRole("heading", { name: "The registry, re-read on request" })).toBeVisible();
    await expect(registry.getByRole("region", { name: "Pexiganan selected original trial records" })).toBeVisible({ timeout: 30000 });
    // Summary, then the six checks, then the registry rows; the register and the no-lab limit follow.
    const tops = await page.evaluate(() => ["passport-claims", "passport-studies"].map(id => document.getElementById(id)!.getBoundingClientRect().top));
    const summaryTop = await summary.evaluate(el => el.getBoundingClientRect().top);
    expect(summaryTop).toBeLessThan(tops[0]);
    expect(tops[0]).toBeLessThan(tops[1]);
    await expect(page.locator("main section#sources").getByRole("region", { name: "Original evidence source register" })).toBeVisible();
    await expect(page.locator("main section#sources")).toContainText("original records");
    await expect(page.locator("main section#material-evidence").getByRole("heading", { name: "No research-material testing verified here" })).toBeVisible();
    // Every claim keeps its deep-link anchor on this page, so an old #evidence-claim-<id> link still lands.
    const html = await (await request.get("/compounds/pexiganan")).text();
    const ids = [...html.matchAll(/id="(evidence-claim-[^"]+)"/g)].map(m => m[1]);
    expect(new Set(ids).size).toBe(6);
    await page.goto("/compounds/pexiganan#" + ids[5]);
    await expect(page.locator("#" + ids[5])).toBeInViewport();
    await expect(page.locator("main h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Pexiganan, with the receipts." })).toHaveCount(0);
  });

  test("a compound with a research file is public and carries the file's six sections in order", async ({ page }) => {
    const res = await page.goto("/compounds/pexiganan");
    expect(res?.status()).toBe(200);
    const ids = await page.locator("main section[id]").evaluateAll(els => els.map(e => e.id));
    const order = ["overview", "file-grade", "studies", "sources", "material-evidence", "related"].map(id => ids.indexOf(id));
    expect(order.every(i => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    await expect(page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: /Overview/ })).toBeVisible();
    await expect(page.locator("main h1")).toHaveCount(1);
    // Pexiganan has no catalog record in the fixtures, so no catalog section may appear.
    await expect(page.locator("#understand, #lab-tests, #research, #stacked")).toHaveCount(0);
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/\$\s?\d|\/\s?mg\b|add to cart|buy now|\bin stock\b|visit (?:the )?store|cheapest/i);
  });

  test("an unknown slug is a 404, not a blank page", async ({ page, request }) => {
    // Without the browse release the gate forwards an unknown compound to the retired notice; with it
    // the page answers 404 itself. page.goto follows the 307, so ask once without following.
    const res = await request.get("/compounds/not-a-compound-at-all", { maxRedirects: 0 });
    expect(res.status()).toBe(browse ? 404 : 307);
    if (browse) {
      const shown = await page.goto("/compounds/not-a-compound-at-all");
      expect(shown?.status()).toBe(404);
      await expect(page.locator("h1").first()).toBeVisible();
    } else {
      expect(res.headers().location).toContain("/intelligence?notice=retired");
    }
  });

  test("a catalog-only compound carries no research-file sections", async ({ page }) => {
    test.skip(!browse, "Catalog pages need the browse release");
    const res = await page.goto("/compounds/bpc-157");
    expect(res?.status()).toBe(200);
    await expect(page.locator("#overview, #file-grade, #studies, #sources, #material-evidence, #related")).toHaveCount(0);
    await expect(page.locator("#lab-tests")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "On this page" })).toBeVisible();
  });
});

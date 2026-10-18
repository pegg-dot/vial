import { expect, test } from "@playwright/test";

test.describe("public research intelligence", () => {
  test("offers a useful evidence workspace without sign-in or buyer funnels", async ({ page }) => {
    await page.goto("/intelligence");
    await expect(page.getByRole("heading", { name: /Investigate the evidence/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open evidence dossier" })).toHaveCount(3);
    await expect(page.getByText("Cross-topic source coverage")).toBeVisible();
    await expect(page.getByText("ClinicalTrials.gov returned sample")).toBeVisible();
    await expect(page.getByText("OpenAlex returned sample")).toBeVisible();
  });

  test("publishes a source-linked dossier with filters and a browser-only citation export", async ({ page }) => {
    await page.goto("/intelligence/retatrutide");
    await expect(page.getByRole("heading", { level: 1, name: "Retatrutide" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "The dated evidence trail" })).toBeVisible();
    await page.getByRole("button", { name: "Trial registry", exact: true }).click();
    await expect(page.getByRole("button", { name: "Trial registry", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Publications", exact: true }).click();
    await expect(page.getByRole("button", { name: "Publications", exact: true })).toHaveAttribute("aria-pressed", "true");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export citations" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("vialgrade-retatrutide-sources.md");
    await expect(page.getByText("These are small search-result samples", { exact: false })).toBeVisible();
  });

  test("supports all fixed public dossier routes, not arbitrary URL topics", async ({ page }) => {
    for (const key of ["retatrutide", "cagrilintide", "tirzepatide"]) {
      await page.goto("/intelligence/" + key);
      await expect(page.locator("h1")).toContainText(key, { ignoreCase: true });
    }
  });
});

test.describe("research-only production release gate", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true", "Only applicable to the research-only deployment mode");

  test("removes old marketplace chrome and legacy vendor data from public access", async ({ page }) => {
    await page.goto("/intelligence");
    await expect(page.getByRole("navigation", { name: "Research navigation" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Market", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Saved", exact: true })).toHaveCount(0);
    const robots = await page.request.get("/robots.txt");
    expect(await robots.text()).toContain("Disallow: /vendors");
    const vendor = await page.request.get("/vendors", { maxRedirects: 0 });
    expect(vendor.status()).toBe(307);
    expect(vendor.headers().location).toBe("/intelligence");
    const catalog = await page.request.get("/api/v1/catalog");
    expect(catalog.status()).toBe(410);
  });

  test("retains legal notices and account access for historical data requests", async ({ page }) => {
    await page.goto("/legal/privacy");
    await expect(page.getByRole("heading", { name: /Privacy/i })).toBeVisible();
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator("main")).toBeVisible();
  });
});


test.describe("legacy account rights in research-only mode", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true", "Only applicable to the research-only deployment mode");

  test("existing customers can reach account security while new research tracking stays paused", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nora@example.test");
    await page.getByLabel("Password", { exact: true }).fill("VialGradeDemoCustomer!2026");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/account/);
    await page.goto("/account/security");
    await expect(page.getByRole("heading", { name: "Security" })).toBeVisible();
    const watchlistWrite = await page.request.put("/api/v1/watchlist", {
      data: { slug: "bpc-157", watched: true },
    });
    expect(watchlistWrite.status()).toBe(410);
    const admin = await page.request.get("/admin", { maxRedirects: 0 });
    expect(admin.status()).toBe(307);
  });

  test("legacy staff dashboard remains behind staff authentication", async ({ page }) => {
    const denied = await page.request.get("/admin", { maxRedirects: 0 });
    expect(denied.status()).toBe(307);
    const login = await page.request.post("/api/v1/auth/login", {
      data: {
        email: "jon@vialgrade.test",
        password: "VialGradeDemoAdmin!2026",
        workspace: "staff",
      },
    });
    expect(login.status()).toBe(200);
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /Traffic you can prove/i })).toBeVisible();
    // A dedicated privacy admin UI is NOT presently implemented. Data requests
    // remain a documented manual process; don't mistake the generic 404 page
    // for an operational privacy console.
    const missing = await page.request.get("/admin/privacy", { maxRedirects: 0 });
    expect(missing.status()).toBe(404);
  });
});

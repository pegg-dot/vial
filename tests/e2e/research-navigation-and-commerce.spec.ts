import { expect, test } from "@playwright/test";

test.describe("research-only navigation and permanent purchase suspension", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true", "Research-only public mode");

  test("refuses checkout, new carts and outbound seller/referral APIs even from direct requests", async ({ page }) => {
    const purchaseEndpoints = [
      "/go",
      "/go/seller-id",
      "/api/partner/conversion",
      "/api/v1/commerce/cart",
      "/api/v1/commerce/cart/item",
      "/api/v1/commerce/checkout",
      "/api/v1/commerce/checkout/idempotency-key",
      "/api/v1/commerce/approved-checkout",
      "/api/v1/commerce/activation",
      "/api/v1/commerce/provider/onboarding",
      "/api/v1/commerce/provider/sync",
    ];
    for (const path of purchaseEndpoints) {
      const get = await page.request.get(path, { maxRedirects: 0 });
      expect(get.status(), "GET " + path).toBe(410);
      const post = await page.request.post(path, { data: {}, maxRedirects: 0 });
      expect(post.status(), "POST " + path).toBe(410);
      expect(post.headers()["cache-control"] || "").toMatch(/no-store/);
    }
    const catalog = await page.request.get("/api/v1/catalog");
    expect(catalog.status()).toBe(410);
    for (const path of ["/cart", "/checkout", "/market", "/vendors", "/products/example"]) {
      const result = await page.request.get(path, { maxRedirects: 0 });
      expect(result.status(), path).toBe(307);
      const location = new URL(result.headers().location!, "http://localhost");
      expect(location.pathname).toBe("/intelligence");
      expect(location.searchParams.get("notice")).toBe("retired");
    }
  });

  test("staff session cannot accidentally re-enable public marketplace routes or purchase endpoints", async ({ page }) => {
    const login = await page.request.post("/api/v1/auth/login", {
      data: { email: "jon@vialgrade.test", password: "VialGradeDemoAdmin!2026", workspace: "staff" },
    });
    expect(login.status()).toBe(200);
    const market = await page.request.get("/market", { maxRedirects: 0 });
    expect(market.status()).toBe(307);
    const purchase = await page.request.post("/api/v1/commerce/approved-checkout", {
      data: {}, maxRedirects: 0,
    });
    expect(purchase.status()).toBe(410);
    const providerSetup = await page.request.post("/api/v1/commerce/provider/sync", {
      data: {}, maxRedirects: 0,
    });
    expect(providerSetup.status()).toBe(410);
  });

  test("small-screen research navigation stays usable and no page overflows horizontally", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/intelligence");
    await expect(page.getByRole("heading", { name: "Discover what deserves a closer look." })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Research navigation" }).getByRole("link", { name: "Explore" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Research navigation" }).getByRole("link", { name: "Compare" })).toBeVisible();
    const indexWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(indexWidth).toBeLessThanOrEqual(391);
    await page.getByRole("navigation", { name: "Research navigation" }).getByRole("link", { name: "Explore" }).click();
    await expect(page).toHaveURL(/\/intelligence#explore$/);
    await expect(page.getByRole("heading", { name: "Discover what deserves a closer look." })).toBeVisible();
    const auditWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(auditWidth).toBeLessThanOrEqual(391);
  });

  test("retired paths clearly explain the shutdown rather than dumping visitors onto an unexplained index", async ({ page }) => {
    await page.goto("/market");
    await expect(page).toHaveURL(/\/intelligence\?notice=retired$/);
    await expect(page.getByRole("status").getByText("The old marketplace is inactive.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open example dossier" })).toBeVisible();
    await page.goto("/how-we-check");
    await expect(page).toHaveURL(/\/intelligence\?notice=retired$/);
  });

  test("every visible internal public link on research and legal pages leads somewhere real", async ({ page }) => {
    const publicPages = [
      "/intelligence", "/intelligence/retatrutide", "/intelligence/cagrilintide",
      "/intelligence/tirzepatide", "/intelligence/cagrilintide/audit", "/intelligence/studies/NCT05804162", "/intelligence/explore/cagrilintide", "/intelligence/explore/ll-37", "/intelligence/explore/oxytocin", "/intelligence/explore/ziconotide", "/intelligence/compare?subjects=semaglutide,tirzepatide",
      "/legal/us-regulations", "/legal/privacy", "/legal/contact",
      "/legal/terms", "/legal/disclaimer", "/login", "/register",
    ];
    const targets = new Map<string, Set<string>>();
    const disallowedPaths = new Set([
      "/market", "/checkout", "/cart", "/go", "/vendors", "/how-we-check", "/products",
    ]);
    for (const path of publicPages) {
      const response = await page.goto(path);
      expect(response?.status(), "Page " + path).toBe(200);
      const links = await page.locator("a[href]").evaluateAll(nodes => nodes.map(node => node.getAttribute("href") ?? ""));
      const current = page.url();
      for (const href of links) {
        if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("blob:")) continue;
        const url = new URL(href, current);
        if (url.origin !== new URL(current).origin) continue;
        expect(disallowedPaths.has(url.pathname), path + " links to paused " + href).toBe(false);
        const key = url.pathname + url.search;
        const fragments = targets.get(key) ?? new Set<string>();
        if (url.hash.length > 1) fragments.add(decodeURIComponent(url.hash.slice(1)));
        targets.set(key, fragments);
      }
    }
    for (const [target, hashes] of targets) {
      const response = await page.request.get(target, { maxRedirects: 0 });
      expect(response.status(), "Internal link " + target).toBe(200);
      if (hashes.size) {
        const html = await response.text();
        for (const hash of hashes) {
          expect(html.includes('id="' + hash + '"'), "Missing anchor " + target + "#" + hash).toBe(true);
        }
      }
    }
  });
});

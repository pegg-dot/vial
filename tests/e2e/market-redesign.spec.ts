import { expect, test } from "@playwright/test";

const SHOTS = process.env.VIALGRADE_SHOT_DIR ?? "audits/market-redesign";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

test("market shows curated rows, filters, and quick-view paging", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto("/market");
  await expect(page.getByRole("heading", { name: /on one screen/i })).toBeVisible();
  await expect(page.getByText(/hand you to the vendor/i)).toBeVisible();
  // Category rail + always-present curated rows (Trending needs only ≥1 compound; Stacks
  // resolve from the recovery compounds always seeded). "Independently verified" is NOT
  // asserted — it renders only when the dataset has independent COAs (honest by design).
  //
  // This asserted the "Weight & Metabolic" pill by name. That shelf holds zero listings in this
  // fixture, and the assertion passed only because the rail used to render all nine shelves
  // regardless of stock — i.e. the test was holding a dead filter in place. The rail is now gated
  // on stock, so assert its shape instead of a label that depends on what happens to be seeded.
  // tests/e2e/browse-surfaces.spec.ts proves every rendered pill returns listings.
  const rail = page.locator(".scroll-fade-x").first();
  await expect(rail.getByRole("button", { name: /^All/ })).toBeVisible();
  expect(await rail.getByRole("button").count()).toBeGreaterThan(1);
  await expect(page.getByRole("heading", { name: /Trending now/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Stacks & blends/i })).toBeVisible();

  // Quick-view opens on a compound ticker tile, pages with the keyboard, closes on Escape.
  await page.getByRole("button", { name: /Quick view/i }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Open full ticker/i)).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // The faceted browse grid renders a live listing count.
  await expect(page.getByTestId("market-count")).toBeVisible();

  expect(errors.filter((e) => !/favicon|manifest/i.test(e))).toEqual([]);

  // Pressing a stack card opens THAT stack's page. It used to open whichever compound was first in
  // the recipe, so "GLOW" and "KLOW" both landed on /compounds/ghk-cu. Wolverine is first and its
  // components (BPC-157, TB-500) are always seeded.
  await page.locator('a[href="/stacks/wolverine"]').first().click();
  await expect(page).toHaveURL(/\/stacks\/wolverine$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Wolverine");
  await expect(page.getByRole("heading", { name: /Cheapest way to buy/i })).toBeVisible();
  await expect(page.getByRole("cell", { name: /^Combined$/ })).toBeVisible();
});

test("a stack can be saved like a listing, survives signing in, and shows up in Saved", async ({ page }) => {
  await page.goto("/market");
  await expect(page.getByRole("heading", { name: /Stacks & blends/i })).toBeVisible();
  await page.getByRole("button", { name: /^Save Wolverine$/ }).click();
  await expect(page.getByRole("button", { name: /Remove Wolverine from saved/ })).toBeVisible();
  // …and a listing, so the sign-in merge is proved for BOTH stores at once: the stack merge once
  // cleared the listing key before the listing merge had read it.
  await page.getByRole("button", { name: /Add to watchlist/ }).first().click();
  await expect(page.getByRole("button", { name: /Remove from watchlist/ }).first()).toBeVisible();
  // The header's Saved badge counts it. /watchlist is customer-only in the perimeter, so a guest
  // is sent to sign in — and the save has to come through the sign-in with them (it is merged into
  // the account on the first authenticated load, exactly as a guest's saved listings are).
  const savedLink = page.getByRole("link", { name: /^Saved\s*2$/ });
  await expect(savedLink).toBeVisible();
  await savedLink.click();
  await expect(page).toHaveURL(/\/login\?next=%2Fwatchlist$/);
  await page.fill('input[name="email"]', "nora@example.test");
  await page.fill('input[name="password"]', "VialGradeDemoCustomer!2026");
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  await expect(page).toHaveURL(/\/watchlist$/);
  await expect(page.getByRole("heading", { name: /^1 stack$/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open the Wolverine stack/ })).toBeVisible();
  // The account holds both, the stack under its own key, split out of the listing slugs.
  // The demo account is shared with other runs, so assert what THIS run put there, then leave
  // only that behind so the assertions below are exact.
  const body = await (await page.request.get("/api/v1/watchlist")).json();
  expect(body.stacks).toContain("wolverine");
  expect(body.slugs).toHaveLength(1);
  for (const slug of body.stacks.filter((s: string) => s !== "wolverine")) await page.request.put("/api/v1/watchlist", { data: { slug: `stack:${slug}`, watched: false } });
  // The store refuses what it cannot vouch for: a stack that does not exist, and a flag that is
  // not a boolean (Boolean("false") is true — the string once SAVED).
  expect((await page.request.put("/api/v1/watchlist", { data: { slug: "stack:not-a-stack", watched: true } })).status()).toBe(400);
  expect((await page.request.put("/api/v1/watchlist", { data: { slug: "stack:klow", watched: "false" } })).status()).toBe(400);
  expect((await (await page.request.get("/api/v1/watchlist")).json()).stacks).toEqual(["wolverine"]);
  // Unsave from the Saved page; the section goes away and the account forgets it.
  await page.getByRole("button", { name: /Remove Wolverine from saved/ }).click();
  await expect(page.getByRole("heading", { name: /^1 stack$/ })).toHaveCount(0);
  await expect.poll(async () => (await (await page.request.get("/api/v1/watchlist")).json()).stacks).toEqual([]);
  // Leave the demo account as it was found.
  for (const slug of body.slugs) await page.request.put("/api/v1/watchlist", { data: { slug, watched: false } });
});

test("compounds opens on shelves, with a shelf rail, and the terminal one click away", async ({ page }) => {
  await page.goto("/compounds");
  await expect(page.getByRole("heading", { name: /we track/i })).toBeVisible();
  // Shelves are the default view. Healing & Recovery is guaranteed — the recovery compounds
  // (BPC-157/KPV) are always seeded — and the rail offers it as a filter without scrolling.
  await expect(page.getByRole("heading", { name: /Healing & Recovery/i })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByText(/Wolverine/i).first()).toBeVisible();
  const rail = page.locator(".scroll-fade-x").filter({ has: page.getByRole("button", { name: /^All/ }) }).first();
  await rail.getByRole("button", { name: /Healing & Recovery/ }).click();
  await expect(page.getByRole("heading", { name: /Healing & Recovery/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Longevity/i })).toHaveCount(0);
  await rail.getByRole("button", { name: /^All/ }).click();
  // The toggle flips to the ranked table, which paginates (fifteen, then more on request).
  await page.getByRole("button", { name: /Terminal/i }).click();
  await expect(page.getByRole("table")).toBeVisible();
  expect(await page.getByRole("table").getByRole("button", { name: /Quick view/i }).count()).toBeLessThanOrEqual(15);
  await expect(page.getByText(/^Showing \d+ of \d+$/)).toBeVisible();
});

test("capture desktop + mobile screenshots", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/market");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/market-desktop.png`, fullPage: true });
  await page.getByRole("button", { name: /Quick view/i }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/market-quickview.png` });
  await page.keyboard.press("Escape");
  await page.goto("/compounds");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/compounds-terminal.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/market");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/market-mobile.png`, fullPage: true });
  await page.goto("/compounds");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/compounds-mobile.png`, fullPage: true });
});

import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

async function loginCustomer(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("nora@example.test");
  await page.getByLabel("Password").fill("VialDemoCustomer!2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account/);
}

test("home page and command search expose the market", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /buying peptides/i })).toBeVisible();
  await page.getByRole("button", { name: /Search the market/i }).click();
  await expect(page.getByRole("dialog", { name: "Search VIAL" })).toBeVisible();
  await page.getByLabel("Search query").fill("MOTS-c");
  await expect(page.getByRole("link", { name: /MOTS-c/i }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Search VIAL" })).toBeHidden();
  // A production build made without NEXT_PUBLIC_SITE_URL keeps upgrade-insecure-requests
  // in its CSP, which breaks prefetches over plain-http localhost. Not a product error.
  expect(consoleErrors.filter((message) => !message.includes("ERR_SSL_PROTOCOL_ERROR"))).toEqual([]);
});

test("market filters update the listing grid", async ({ page }) => {
  await page.goto("/market");
  await expect(page.getByTestId("market-count")).toHaveText("12 listings");
  await page.getByLabel("Compound").selectOption("mots-c");
  await expect(page.getByTestId("market-count")).toHaveText("2 listings");
  await expect(page.getByRole("link", { name: /MOTS-c 10 mg/i }).first()).toBeVisible();
});

test("watchlist persists through navigation", async ({ page }) => {
  await loginCustomer(page);
  await page.goto("/market");
  await page.getByRole("button", { name: "Add to watchlist" }).first().click();
  await page.getByRole("link", { name: "Saved", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Your saved listings." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove from watchlist" })).toBeVisible();
});

test("compare dock routes to a dimensional comparison", async ({ page }) => {
  await page.goto("/market");
  const compareButtons = page.getByRole("button", { name: "Add to comparison" });
  await compareButtons.nth(0).click();
  await compareButtons.nth(1).click();
  await page.getByRole("link", { name: "Compare", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: /Compare the claims/i })).toBeVisible();
  await expect(page.getByText("Evidence level", { exact: true })).toBeVisible();
  await expect(page.getByText("Sample origin", { exact: true })).toBeVisible();
});

test("mobile navigation remains usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
  await page.getByRole("link", { name: "How we check", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: /Trust is a chain of evidence/i })).toBeVisible();
});

test("consumer intelligence preserves decisions across the authenticated experience", async ({ page }) => {
  await loginCustomer(page);
  await page.goto("/for-you");
  await expect(page.getByRole("heading", { name: /Welcome back, Nora/i })).toBeVisible();
  await expect(page.getByText(/Picked for you, with reasons/i)).toBeVisible();

  await page.goto("/saved-searches");
  await expect(page.getByRole("heading", { name: /Your saved searches/i })).toBeVisible();
  await expect(page.getByText("BPC-157 with current evidence")).toBeVisible();

  await page.goto("/compare");
  await expect(page.getByText("Northstar Research")).toBeVisible();
  await page.getByPlaceholder("Name this comparison").fill("E2E comparison");
  await page.getByRole("button", { name: "Save snapshot" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();

  await page.goto("/account/history");
  await expect(page.getByRole("heading", { name: "Recently viewed" })).toBeVisible();
});

test("mobile authenticated navigation exposes the retention loop", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginCustomer(page);
  await expect(page.getByRole("navigation", { name: "Mobile account navigation" })).toBeVisible();
  await page.getByRole("link", { name: "For you", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: /Welcome back, Nora/i })).toBeVisible();
});

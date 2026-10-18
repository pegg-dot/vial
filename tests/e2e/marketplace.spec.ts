import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

async function loginCustomer(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("nora@example.test");
  await page.getByLabel("Password", { exact: true }).fill("VialGradeDemoCustomer!2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account/);
}

// This was failing because of a real bug, not a stale expectation. getCertificatesOnRecord returns
// a NUMBER and the homepage guarded with `!labTests`, so a database holding zero certificates —
// a fresh deployment, or this harness — rendered the outage notice claiming the catalogue was
// unreachable and that the figures were "not zero, and nothing has been lost". Both false. See
// isReadable in public-repository: a failed read is null, and zero is an answer.

test("home page and command search expose the market", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /records actually show/i })).toBeVisible();
  await page.getByRole("button", { name: /Search research records/i }).click();
  await expect(page.getByRole("dialog", { name: "Search VialGrade" })).toBeVisible();
  await page.getByLabel("Search query").fill("MOTS-c");
  await expect(page.getByRole("link", { name: /MOTS-c/i }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Search VialGrade" })).toBeHidden();
  // A production build made without NEXT_PUBLIC_SITE_URL keeps upgrade-insecure-requests
  // in its CSP, which breaks prefetches over plain-http localhost. Not a product error.
  expect(consoleErrors.filter((message) => !message.includes("ERR_SSL_PROTOCOL_ERROR"))).toEqual([]);
});

test("market filters update the listing grid", async ({ page }) => {
  await page.goto("/market");
  await expect(page.getByTestId("market-count")).toHaveText("12 listings");
  // The redesign replaced the 60-item compound dropdown with search + category shelves;
  // narrowing to a single compound is now done via the browse search box.
  await page.getByPlaceholder("Compound, vendor, or quantity").fill("MOTS-c");
  await expect(page.getByTestId("market-count")).toHaveText("2 listings");
  await expect(page.getByRole("link", { name: /MOTS-c 10 mg/i }).first()).toBeVisible();
});

test("authenticated watchlist writes are suspended during privacy review", async ({ page }) => {
  await loginCustomer(page);
  const result = await page.request.put("/api/v1/watchlist", { data: { slug: "bpc-157", watched: true } });
  expect(result.status()).toBe(410);
  await page.goto("/intelligence");
  await expect(page.getByRole("heading", { name: /Check a trial. Follow the evidence./i })).toBeVisible();
});

test("compare dock routes to a dimensional comparison", async ({ page }) => {
  await page.goto("/market");
  const compareButtons = page.getByRole("button", { name: "Add to comparison" });
  await compareButtons.nth(0).click();
  await compareButtons.nth(1).click();
  await page.getByRole("link", { name: "Compare", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: /Compare the claims/i })).toBeVisible();
  // The deep comparison surfaces graded + hidden dimensions, not just marketing booleans.
  await expect(page.getByText("Trust verdict", { exact: true })).toBeVisible();
  await expect(page.getByText("Batch-matched COA", { exact: true })).toBeVisible();
});

test("mobile navigation remains usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
  await page.getByRole("link", { name: "How we check", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: /Trust is a chain of evidence/i })).toBeVisible();
});

test("personalized account surfaces are read-only until privacy review", async ({ page }) => {
  await loginCustomer(page);
  await page.goto("/for-you");
  await expect(page.getByRole("heading", { name: /Personalized research is paused/i })).toBeVisible();
  const response = await page.request.post("/api/v1/saved-searches", { data: { name: "Research alerts", query: "BPC-157" } });
  expect(response.status()).toBe(410);
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: /New account registration is paused/i })).toBeVisible();
});

test("mobile authenticated navigation exposes the retention loop", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginCustomer(page);
  await expect(page.getByRole("navigation", { name: "Mobile account navigation" })).toBeVisible();
  await page.getByRole("link", { name: "For you", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: /Personalized research is paused/i })).toBeVisible();
});

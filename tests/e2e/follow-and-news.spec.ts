import { expect, test } from "@playwright/test";

// NOTE: do NOT clear localStorage via addInitScript — it runs on EVERY navigation, which would
// wipe the sign-in prompt's dismissal flag between page loads and make "ask once" look broken.

test.describe("privacy-first research mode", () => {
  test("shows research limitations instead of personal following", async ({ page }) => {
    await page.goto("/compounds/bpc-157");
    await expect(page.getByText(/Personal research alerts are paused during privacy review/)).toBeVisible();
    const notice = page.getByRole("complementary", { name: "Research record limitations" });
    await expect(notice).toBeVisible();
    await notice.getByText(/What does.*research use only.*actually mean/).click();
    await expect(notice.getByText(/not a general FDA exemption/i)).toBeVisible();
  });

  test("does not solicit account creation from browsing readers", async ({ page }) => {
    await page.goto("/market");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await page.waitForTimeout(11_200);
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("keeps existing sign-in available but pauses registration", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Existing account sign in" })).toBeVisible();
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: /New account registration is paused/i })).toBeVisible();
  });

  test("closes interactive verifier until provenance and privacy review", async ({ page }) => {
    await page.goto("/verify");
    await expect(page.getByRole("heading", { name: /Interactive verification is temporarily paused/i })).toBeVisible();
    expect((await page.request.post("/api/v1/verify", { data: { query: "BPC-157" } })).status()).toBe(410);
  });
});

test.describe("news feed", () => {
  test("pages ten at a time", async ({ page }) => {
    await page.goto("/news");
    const total = Number((await page.getByTestId("news-count").textContent())!.match(/\d+/)![0]);
    expect(total, "this fixture needs more than one page of news to test paging").toBeGreaterThan(10);
    await expect(page.locator("ol > li")).toHaveCount(10);

    await page.getByRole("button", { name: /^Show \d+ more$/ }).click();
    await expect(page.locator("ol > li")).toHaveCount(Math.min(total, 20));
  });

  test("keyword search narrows the feed and survives a reload", async ({ page }) => {
    await page.goto("/news");
    const before = Number((await page.getByTestId("news-count").textContent())!.match(/\d+/)![0]);
    // "lilly" appears in the curated baseline (the Lilly suit and the ITC complaint) and nowhere
    // near every record — a term that matched everything would prove nothing about filtering.
    await page.getByLabel("Search news").fill("lilly");
    const after = Number((await page.getByTestId("news-count").textContent())!.match(/\d+/)![0]);
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);

    // The filter is in the URL, so a filtered view can be sent to someone.
    await expect(page).toHaveURL(/\?q=lilly/);
    await page.reload();
    await expect(page.getByLabel("Search news")).toHaveValue("lilly");
    await expect(page.getByTestId("news-count")).toContainText(String(after));
  });

  test("source and topic chips narrow the feed and clear again", async ({ page }) => {
    await page.goto("/news");
    // Scoped to the filter landmark: each result row also renders its topics as buttons, so an
    // unscoped role query is ambiguous by design.
    const filters = page.getByRole("region", { name: "Filter the news feed" });
    const all = Number((await page.getByTestId("news-count").textContent())!.match(/\d+/)![0]);

    await filters.getByRole("button", { name: /^Official record/ }).click();
    const official = Number((await page.getByTestId("news-count").textContent())!.match(/\d+/)![0]);
    expect(official).toBeGreaterThan(0);
    expect(official).toBeLessThan(all);

    await filters.getByRole("button", { name: /^Enforcement/ }).click();
    const both = Number((await page.getByTestId("news-count").textContent())!.match(/\d+/)![0]);
    // Filters intersect. Adding one must never ADD results.
    expect(both).toBeLessThanOrEqual(official);

    await filters.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByTestId("news-count")).toContainText(String(all));
  });

  test("says so plainly when nothing matches", async ({ page }) => {
    await page.goto("/news");
    await page.getByLabel("Search news").fill("zzzzznotathinginthisfeed");
    await expect(page.getByText("Nothing on record matches that.")).toBeVisible();
    await expect(page.locator("ol > li")).toHaveCount(0);
  });
});

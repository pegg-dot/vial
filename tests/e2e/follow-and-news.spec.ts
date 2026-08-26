import { expect, test } from "@playwright/test";

// NOTE: do NOT clear localStorage via addInitScript — it runs on EVERY navigation, which would
// wipe the sign-in prompt's dismissal flag between page loads and make "ask once" look broken.

async function loginCustomer(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("nora@example.test");
  await page.getByLabel("Password").fill("VialGradeDemoCustomer!2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account/);
}

test.describe("following", () => {
  // The bug this covers: a signed-out "Follow changes" click used to redirect to /login and drop
  // the follow. The visitor came back to the same page with the button reset and nothing said so.
  test("a signed-out follow survives signing up", async ({ page }) => {
    await page.goto("/compounds/bpc-157");
    await page.getByRole("button", { name: "Follow changes" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // The ask names what was clicked, so it never reads as an arbitrary interruption.
    await expect(dialog.getByText(/Follow BPC-157 for changes/i)).toBeVisible();

    await dialog.getByLabel("Name").fill("E2E Follower");
    await dialog.getByLabel("Email").fill(`e2e-follow-${Date.now()}@example.test`);
    await dialog.getByLabel("Password").fill("E2EFollowerPass!2026");
    await dialog.getByRole("button", { name: "Create free account" }).click();

    await expect(page.getByRole("button", { name: "Following" })).toBeVisible();

    // A reload is the real test. An optimistic button that resets on refresh is the same bug in a
    // nicer coat, so assert the follow reached the database.
    await page.reload();
    await expect(page.getByRole("button", { name: "Following" })).toBeVisible();

    // And it must be visible to the person who made it. Follows used to be write-only: nothing in
    // the app ever rendered them back.
    await page.goto("/for-you");
    await expect(page.getByRole("heading", { name: "What you asked to hear about" })).toBeVisible();
    await expect(page.getByRole("link", { name: /BPC-157/ }).first()).toBeVisible();
  });

  test("a signed-in follow can be undone from For you", async ({ page }) => {
    await loginCustomer(page);
    await page.goto("/vendors");
    const vendorHref = await page.locator('a[href^="/vendors/"]').first().getAttribute("href");
    await page.goto(vendorHref!);
    const button = page.getByRole("button", { name: /Follow changes|Following/ });
    if ((await button.textContent())?.includes("Following")) await button.click();
    await expect(page.getByRole("button", { name: "Follow changes" })).toBeVisible();

    await page.getByRole("button", { name: "Follow changes" }).click();
    await expect(page.getByRole("button", { name: "Following" })).toBeVisible();

    await page.goto("/for-you");
    const unfollow = page.getByRole("button", { name: /^Stop following / }).first();
    await expect(unfollow).toBeVisible();
    const label = await unfollow.getAttribute("aria-label");
    await unfollow.click();
    await expect(page.getByRole("button", { name: label! })).toBeHidden();

    // Undone in the database, not only on screen.
    await page.reload();
    await expect(page.getByRole("button", { name: label! })).toBeHidden();
  });
});

test.describe("sign-in prompt", () => {
  test("appears after the delay, and stays gone once dismissed", async ({ page }) => {
    await page.goto("/market");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.waitForTimeout(11_500);
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Not now" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    // The whole point of "not now": a second page must not ask again.
    await page.goto("/compounds");
    await page.waitForTimeout(11_500);
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("never interrupts the sign-in and register pages themselves", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await page.waitForTimeout(11_500);
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("a phone visitor has a sign-in control in the header", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    // This was `hidden sm:block`: on the device most buyers arrive with there was no sign-in
    // affordance in the header bar at all.
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
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

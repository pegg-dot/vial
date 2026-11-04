import { expect, test } from "@playwright/test";

// The server and this process must share the same mail configuration. CI has none, so the
// "configured" tests skip there and the "not switched on" tests run; locally start the server with
// RESEND_API_KEY / DIGEST_FROM_EMAIL set (any dummy values) and set them here too.
const configured = Boolean(process.env.RESEND_API_KEY && process.env.DIGEST_FROM_EMAIL);

test.describe("Weekly update email", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true", "Research-only preview");

  test("signup page says plainly what is stored; without mail configured it collects nothing", async ({ page }) => {
    await page.goto("/intelligence/updates");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Get a note when a source record changes");
    await expect(page.getByText("Email only. No account, no saved compounds, no searches, no interests.")).toBeVisible();
    await expect(page.getByText(/deletes your address immediately/)).toBeVisible();
    if (!configured) {
      await expect(page.getByText(/not switched on yet, so we are not collecting addresses/)).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Email address" })).toHaveCount(0);
    }
    const text = (await page.locator("main").innerText()).toLowerCase();
    for (const w of ["buy", "shop", "price", "cart", "available from", "in stock"]) expect(text).not.toContain(w);
  });

  test("confirm and unsubscribe links are inert without a valid token, and a GET never acts", async ({ page }) => {
    await page.goto("/intelligence/updates/confirm");
    await expect(page.getByText(/Open the confirmation link from your email/)).toBeVisible();
    await page.goto("/intelligence/updates/confirm?id=nope&t=forged");
    await page.getByRole("button", { name: "Confirm my email address" }).click();
    await expect(page.getByText(/not valid or has expired/)).toBeVisible();
    await page.goto("/intelligence/updates/unsubscribe?id=nope&t=forged");
    await expect(page.getByRole("button", { name: "Unsubscribe and delete my address" })).toBeVisible();
    await page.getByRole("button", { name: "Unsubscribe and delete my address" }).click();
    await expect(page.getByText(/This link is not valid/)).toBeVisible();
  });

  test("no bar when mail is not configured, even after 10 seconds and a scroll", async ({ page }) => {
    test.skip(configured, "Server has mail configured");
    await page.clock.install();
    await page.goto("/intelligence");
    await page.clock.fastForward(12_000);
    await page.mouse.wheel(0, 900);
    await expect(page.getByRole("complementary", { name: "Weekly update email" })).toHaveCount(0);
  });

  test.describe("with mail configured", () => {
    test.skip(!configured, "Needs RESEND_API_KEY and DIGEST_FROM_EMAIL on the server");

    test("form needs the consent box, rejects a bad address and saves nothing when mail cannot be sent", async ({ page }) => {
      await page.goto("/intelligence/updates");
      const email = page.getByRole("textbox", { name: "Email address" });
      await email.fill("reader@example.org");
      await page.getByRole("button", { name: "Email me" }).click();
      await expect(page.getByText("Please tick the box so we know you agree.")).toBeVisible();
      // An error must not erase what the reader typed or ticked.
      await expect(email).toHaveValue("reader@example.org");
      await email.fill("not-an-email");
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "Email me" }).click();
      await expect(page.getByText(/does not look like an email address/)).toBeVisible();
      await expect(email).toHaveValue("not-an-email");
      await expect(page.getByRole("checkbox")).toBeChecked();
      // A dummy API key cannot send, so the honest answer is "nothing was saved".
      await email.fill("reader@example.org");
      await page.getByRole("button", { name: "Email me" }).click();
      await expect(page.getByText(/could not send a confirmation email just now, so nothing was saved/)).toBeVisible({ timeout: 20_000 });
    });

    test("bar appears after 10 seconds, is dismissible and stays dismissed", async ({ page }) => {
      await page.clock.install();
      await page.goto("/intelligence/market");
      const bar = page.getByRole("complementary", { name: "Weekly update email" });
      await expect(bar).toHaveCount(0);
      await page.clock.fastForward(9_000);
      await expect(bar).toHaveCount(0);
      await page.clock.fastForward(2_000);
      await expect(bar).toBeVisible();
      await expect(bar.getByText(/Email only, no account, no compound interests saved/)).toBeVisible();
      await expect(bar.getByRole("link", { name: "Email me" })).toHaveAttribute("href", "/intelligence/updates");
      for (const el of await bar.locator("a, button").all()) expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(24);
      await bar.getByRole("button", { name: "Not now" }).click();
      await expect(bar).toHaveCount(0);
      await page.reload();
      await page.clock.fastForward(12_000);
      await expect(page.getByRole("complementary", { name: "Weekly update email" })).toHaveCount(0);
    });

    test("bar also appears on first scroll, and never on legal, login or signup pages", async ({ page }) => {
      await page.goto("/intelligence");
      await page.mouse.wheel(0, 900);
      await expect(page.getByRole("complementary", { name: "Weekly update email" })).toBeVisible();
      for (const path of ["/legal/privacy", "/intelligence/updates", "/login"]) {
        await page.evaluate(() => window.localStorage.clear());
        await page.clock.install();
        await page.goto(path);
        await page.clock.fastForward(12_000);
        await page.mouse.wheel(0, 900);
        await expect(page.getByRole("complementary", { name: "Weekly update email" })).toHaveCount(0);
      }
    });
  });
});

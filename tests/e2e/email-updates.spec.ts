import { expect, test, type Page } from "@playwright/test";

// The server and this process must share the same mail configuration. CI has none, which is also
// production's state today: a signup is saved and confirmed later. To run the "configured" tests
// locally, start the server with RESEND_API_KEY / DIGEST_FROM_EMAIL set (any dummy values) and set
// them here too.
//
// The signup endpoint allows 5 attempts an hour per connection, and the server's database lives as
// long as the server: this file makes 3 consented attempts in total. Keep it under 5.
const configured = Boolean(process.env.RESEND_API_KEY && process.env.DIGEST_FROM_EMAIL);

const READER = "first.reader@example.org";
const prompt = (page: Page) => page.getByRole("dialog", { name: "Monthly update email" });

test.describe("Monthly update email", () => {
  test.skip(process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY !== "true", "Research-only preview");
  // A first-time reader: nothing stored, so the first-visit prompt is due. (The config's default is a returning reader.)
  test.use({ storageState: { cookies: [], origins: [] } });

  test("signup page says plainly what is stored, and says so when the update email has not started", async ({ page }) => {
    await page.goto("/intelligence/updates");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Get a note when a source record changes");
    await expect(page.getByText("Email only. No account, no saved compounds, no searches, no interests.")).toBeVisible();
    await expect(page.getByText(/deletes your address immediately/)).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email address" })).toBeVisible();
    await expect(page.getByText(/update email has not started yet\. If you sign up now we keep your address until it does/)).toHaveCount(configured ? 0 : 1);
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

  test("the prompt opens once, shortly after a reader first arrives, and signing up in it saves the address", async ({ page }) => {
    test.skip(configured, "With mail configured a dummy key cannot send, so nothing is saved");
    await page.clock.install();
    await page.goto("/compounds");
    await expect(prompt(page)).toHaveCount(0);
    await page.clock.fastForward(1_000);
    await expect(prompt(page)).toHaveCount(0);
    await page.clock.fastForward(1_000);
    await expect(prompt(page)).toBeVisible();
    await expect(prompt(page)).toContainText("Get a note when a source record changes.");
    await expect(prompt(page)).toContainText("no account, no compound interests saved");
    // It does not take the page over: no modal, and the page behind still responds.
    await expect(prompt(page)).not.toHaveAttribute("aria-modal", "true");
    await expect(page.getByRole("link", { name: "Compounds" }).first()).toBeEnabled();
    // Controls are full tap size (the privacy link is inline text in the consent sentence, which is exempt).
    for (const el of await prompt(page).locator("button, input[type=email]").all()) expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const text = (await prompt(page).innerText()).toLowerCase();
    for (const w of ["buy", "shop", "price", "cart", "discount", "deal"]) expect(text).not.toContain(w);

    // Consent is a box the reader ticks; an error keeps what they typed.
    const email = prompt(page).getByRole("textbox", { name: "Email address" });
    await email.fill(READER);
    await prompt(page).getByRole("button", { name: "Email me" }).click();
    await expect(prompt(page).getByText("Please tick the box so we know you agree.")).toBeVisible();
    await expect(email).toHaveValue(READER);
    await prompt(page).getByRole("checkbox").check();
    await prompt(page).getByRole("button", { name: "Email me" }).click();
    await expect(prompt(page).getByText(/You are on the list\. The update email has not started yet/)).toBeVisible();
    await expect(prompt(page).getByText("Thank you.")).toBeVisible();
    await expect(prompt(page).getByRole("textbox", { name: "Email address" })).toHaveCount(0);
    await prompt(page).getByRole("button", { name: "Close", exact: true }).last().click();
    await expect(prompt(page)).toHaveCount(0);

    // Once means once: not on reload, not on another page, however long the reader stays.
    await page.reload();
    await page.clock.fastForward(10_000);
    await expect(prompt(page)).toHaveCount(0);
    await page.goto("/intelligence");
    await page.clock.fastForward(10_000);
    await expect(prompt(page)).toHaveCount(0);
  });

  test("closing or ignoring the prompt also counts as seen, and it never opens on legal, sign-in or signup pages", async ({ page }) => {
    await page.clock.install();
    await page.goto("/intelligence");
    await page.clock.fastForward(2_000);
    await expect(prompt(page)).toBeVisible();
    // Ignored: the reader just moves on.
    await page.goto("/vendors");
    await page.clock.fastForward(10_000);
    await expect(prompt(page)).toHaveCount(0);
    // A fresh browser, but a page where it never opens.
    for (const path of ["/legal/privacy", "/intelligence/updates", "/login", "/admin/login"]) {
      await page.evaluate(() => window.localStorage.clear());
      await page.goto(path);
      await page.clock.fastForward(10_000);
      await expect(prompt(page), path).toHaveCount(0);
    }
    // And a fresh browser on a reading page gets it again, closable with "Not now".
    await page.evaluate(() => window.localStorage.clear());
    await page.goto("/compounds/bpc-157");
    await page.clock.fastForward(2_000);
    await expect(prompt(page)).toBeVisible();
    await prompt(page).getByRole("button", { name: "Not now" }).click();
    await expect(prompt(page)).toHaveCount(0);
    await page.reload();
    await page.clock.fastForward(10_000);
    await expect(prompt(page)).toHaveCount(0);
  });

  test("the signup endpoint refuses a missing consent, a bad address and a malformed body, and treats a filled trap field like a signup", async ({ request }) => {
    const post = (data: unknown) => request.post("/intelligence/updates/subscribe", { data, headers: { "content-type": "application/json" } });
    expect(await (await post({ email: "nobody@example.org" })).json()).toEqual({ status: "needs-consent" });
    expect(await (await post({ email: "nobody@example.org", consent: true })).json()).toEqual({ status: "needs-consent" });
    // The trap field: same reply a real signup gets, and nothing stored (the admin test below counts the list).
    expect(await (await post({ email: "bot@example.org", consent: "yes", company: "Acme" })).json()).toEqual({ status: configured ? "sent" : "saved" });
    expect((await post("not json")).status()).toBe(400);
    expect((await post([1, 2])).status()).toBe(400);
    expect((await post({ email: "x".repeat(3000) + "@example.org", consent: "yes" })).status()).toBe(413);
    expect(await (await post({ email: "not-an-email", consent: "yes" })).json()).toEqual({ status: "invalid" });
    expect((await request.get("/intelligence/updates/subscribe")).status()).toBe(405);
  });

  test("the signup page's form saves an address the same way, and the admin overview shows who signed up", async ({ page }) => {
    test.skip(configured, "With mail configured a dummy key cannot send, so nothing is saved");
    await page.goto("/intelligence/updates");
    await page.getByRole("textbox", { name: "Email address" }).fill("page.reader@example.org");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Email me" }).click();
    await expect(page.getByText(/You are on the list\. The update email has not started yet/)).toBeVisible();

    const login = await page.request.post("/api/v1/auth/login", { data: { email: "jon@vialgrade.test", password: "VialGradeDemoAdmin!2026", workspace: "staff" } });
    expect(login.status()).toBe(200);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
    const signups = page.getByTestId("admin-signups");
    // Two real signups (the prompt's and this page's); the trap-field and rejected attempts stored nothing.
    await expect(signups.getByText("On the list").locator("..")).toContainText("2");
    await expect(signups).toContainText("Email sending is not connected, so signups are being saved but nobody is being emailed.");
    await expect(signups.getByRole("img", { name: /Signups per day, last 30 days: 2 signups in total/ })).toBeVisible();
    const latest = signups.getByTestId("signup-table");
    await expect(latest.getByRole("row", { name: /page\.reader@example\.org/ })).toContainText("Waiting");
    await expect(latest.getByRole("row", { name: new RegExp(READER.replace(/\./g, "\\.")) })).toContainText("Waiting");
    await expect(latest).not.toContainText("bot@example.org");

    await signups.getByRole("link", { name: "All signups →" }).click();
    await expect(page).toHaveURL(/\/admin\/signups$/);
    await expect(page.getByRole("heading", { level: 1, name: "Email list" })).toBeVisible();
    await expect(page.getByText("2 on the list: 0 confirmed, 0 sent a confirmation link, 2 waiting for the update email to start.")).toBeVisible();
    await expect(page.getByTestId("signup-table").locator("tbody tr")).toHaveCount(2);
    await expect(page.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name: "Signups" })).toHaveAttribute("aria-current", "page");

    // The overview's other sections are there, and say plainly what is live and what is frozen.
    await page.goto("/admin");
    for (const id of ["signups", "reach", "catalog", "collection", "accounts", "historical"]) await expect(page.locator("#" + id)).toBeVisible();
    await expect(page.getByText(/Reader counting is switched off/)).toBeVisible();
    await expect(page.getByTestId("admin-price-freshness")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Historical referral figures" })).toBeVisible();

    // A signed-in member of staff is not a first-time reader: no prompt for them, on a fresh browser.
    await page.evaluate(() => window.localStorage.clear());
    await page.clock.install();
    await page.goto("/intelligence");
    await page.clock.fastForward(10_000);
    await expect(prompt(page)).toHaveCount(0);
  });

  test("the signups page is staff only", async ({ page }) => {
    await page.goto("/admin/signups");
    await expect(page).toHaveURL(/\/admin\/login/);
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
      await expect(page.getByText(/could not take signups just now, so nothing was saved/)).toBeVisible({ timeout: 20_000 });
    });
  });
});

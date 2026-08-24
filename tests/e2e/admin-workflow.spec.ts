import { expect, test } from "@playwright/test";

const sourceHtml = `<html><head><script type="application/ld+json">{"@type":"Product","name":"BPC-157 10 mg","offers":{"price":"57.00","priceCurrency":"USD","availability":"https://schema.org/InStock"}}</script></head><body><h1>BPC-157 10 mg</h1><p>Shipping: 1-3 business days.</p><p>Batch: NS-BPC-E2E</p><p>Report date: July 18, 2026</p><p>Report issuer: Aperture Analytical</p><p>Report confirmed: yes</p></body></html>`;
const protectedAdminRoutes = [
  "/admin",
  "/admin/agents",
  "/admin/analytics",
  "/admin/commerce",
  "/admin/consumer-intelligence",
  "/admin/finance",
  "/admin/fraud",
  "/admin/fulfillment",
  "/admin/ingest",
  "/admin/inventory",
  "/admin/observability",
  "/admin/security",
  "/admin/moderation",
  "/admin/opportunities",
  "/admin/policy",
  "/admin/privacy",
  "/admin/publications",
  "/admin/quality",
  "/admin/reconciliation",
  "/admin/returns",
  "/admin/review",
  "/admin/risk",
  "/admin/runs",
  "/admin/scenarios",
  "/admin/sources",
  "/admin/support",
  "/admin/traces",
  "/admin/users",
  "/admin/webhooks",
];

test("the central admin perimeter redirects every unauthenticated staff page", async ({ request }) => {
  const login = await request.get("/admin/login", { maxRedirects: 0 });
  expect(login.status()).toBe(200);

  for (const route of protectedAdminRoutes) {
    const response = await request.get(route, { maxRedirects: 0 });
    expect(response.status(), route).toBe(307);
    expect(response.headers().location, route).toContain("/admin/login");
  }
});


test("health is public while run receipts require staff", async ({ request }) => {
  const health = await request.get("/api/v1/health");
  expect(health.ok()).toBeTruthy();
  expect((await health.json()).status).toBe("ok");
  const runs = await request.get("/api/v1/runs");
  expect(runs.status()).toBe(401);
});

// ⚠️ The two specs below describe the provenance pipeline — capture a source snapshot, land the
// extracted claims in a review queue, approve one, and watch a publication receipt and a version
// appear on the public product page. That is the architecture AGENTS.md names as the central
// guarantee: "every changed observed value must enter the review queue" and "every approved
// mutation must create a publication receipt in the same transaction".
//
// They are marked fixme because the SURFACE they drive was deleted by 298e7ce ("buyer-only
// surface, one admin"). /admin/ingest, /admin/review, /admin/sources and /admin/publications are
// all gone, and with them the only way a human could review and publish anything. The database
// agrees: source_snapshots, review_decisions and publication_events are empty, and 552 sources
// have produced zero snapshots. The pipeline has never run because its interface no longer exists.
//
// Deleting these specs would erase the last written description of how it is supposed to work, so
// they stay, failing loudly in intent and quietly in CI, until the surface is rebuilt. Restoring
// them is the acceptance test for that work.

test("staff can ingest, review, publish, and observe a catalog update", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Staff email").fill("jon@vialgrade.test");
  await page.getByLabel("Password").fill("VialGradeDemoAdmin!2026");
  await page.getByRole("button", { name: "Continue securely" }).click();
  await expect(page.getByRole("heading", { name: "Traffic you can prove you sent" })).toBeVisible();

  await page.goto("/admin/ingest");
  await page.getByLabel("Target listing").selectOption("northstar-bpc-157-10mg");
  await page.getByLabel("Canonical URL").fill("https://example.invalid/e2e/northstar-bpc-157-10mg");
  await page.getByLabel("Source label").fill("E2E controlled product fixture");
  await page.getByLabel("Captured content").fill(sourceHtml);
  await page.getByRole("button", { name: "Capture and extract" }).click();

  await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();
  await expect(page.getByText(/workflow proposed/i)).toBeVisible();
  const priceClaim = page.locator('article[data-claim-predicate="price"]');
  await expect(priceClaim).toBeVisible();
  await priceClaim.getByRole("button", { name: "Approve and publish" }).click();

  await expect(page.getByRole("heading", { name: "Publication ledger" })).toBeVisible();
  await expect(page.getByText(/claim was published/i)).toBeVisible();
  await expect(page.getByText("Version 1")).toBeVisible();

  await page.goto("/products/northstar-bpc-157-10mg");
  await expect(page.getByText("$57", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("just now", { exact: true }).first()).toBeVisible();
});


test("a controlled fixture change creates one visible cascade", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Staff email").fill("jon@vialgrade.test");
  await page.getByLabel("Password").fill("VialGradeDemoAdmin!2026");
  await page.getByRole("button", { name: "Continue securely" }).click();
  await expect(page.getByRole("heading", { name: "Traffic you can prove you sent" })).toBeVisible();
  await page.goto("/admin/sources");
  await expect(page.getByRole("heading", { name: "Refresh without losing lineage." })).toBeVisible();

  const meridian = page.locator("article").filter({ hasText: "Meridian Biosciences" }).first();
  await expect(meridian).toBeVisible();
  await meridian.getByRole("button", { name: "Advance + trace" }).click();
  await expect(page.getByText(/Refresh operation completed/i)).toBeVisible();

  await page.goto("/admin/review");
  const batchClaim = page.locator('article[data-claim-predicate="batchCode"]').filter({ hasText: "Meridian Biosciences" }).first();
  await expect(batchClaim).toBeVisible();
  await batchClaim.getByRole("button", { name: "Approve and publish" }).click();
  await expect(page.getByRole("heading", { name: "Publication ledger" })).toBeVisible();

  await page.goto("/admin/traces");
  await expect(page.getByText("source.fixture.advanced", { exact: true })).toBeVisible();
  await expect(page.getByText("source.refresh.succeeded", { exact: true })).toBeVisible();
  await expect(page.getByText("listing.batchCode.published", { exact: true })).toBeVisible();
  await expect(page.getByText("opportunity.opened", { exact: true }).first()).toBeVisible();

  await page.goto("/signals");
  await expect(page.getByRole("heading", { name: /moving right now/i })).toBeVisible();
});

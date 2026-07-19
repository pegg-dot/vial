import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.VIAL_AUDIT_BASE_URL ?? "http://127.0.0.1:3000";
await mkdir("audits/screenshots", { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--allow-insecure-localhost",
    "--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessChecks,BlockInsecurePrivateNetworkRequests",
  ],
});

async function capture(name, route, viewport, context) {
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle", timeout: 30_000 });
  await page.screenshot({ path: `audits/screenshots/${name}`, fullPage: true });
  await page.close();
}

const publicContext = await browser.newContext();
for (const [name, route] of [
  ["home-desktop.png", "/"],
  ["market-desktop.png", "/market"],
  ["product-desktop.png", "/products/northstar-bpc-157-10mg"],
  ["admin-login-desktop.png", "/admin/login"],
]) {
  await capture(name, route, { width: 1440, height: 1100 }, publicContext);
}
await capture("home-mobile.png", "/", { width: 390, height: 844 }, publicContext);
await publicContext.close();

const staffContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const staffPage = await staffContext.newPage();
await staffPage.goto(`${baseURL}/admin/login`, { waitUntil: "networkidle", timeout: 30_000 });
await staffPage.getByLabel("Staff token").fill(process.env.VIAL_AUDIT_ADMIN_TOKEN ?? "vial-admin");
await staffPage.getByRole("button", { name: "Continue securely" }).click();
await staffPage.getByRole("heading", { name: "Market operations" }).waitFor();

// Produce one complete source-to-signal trace for visual and causal review.
await staffPage.goto(`${baseURL}/admin/sources`, { waitUntil: "networkidle", timeout: 30_000 });
const meridian = staffPage.locator("article").filter({ hasText: "Meridian Biosciences" }).first();
if (await meridian.getByRole("button", { name: "Advance + trace" }).count()) {
  await meridian.getByRole("button", { name: "Advance + trace" }).click();
  await staffPage.getByText(/Refresh operation completed/i).waitFor();
  await staffPage.goto(`${baseURL}/admin/review`, { waitUntil: "networkidle", timeout: 30_000 });
  const batchClaim = staffPage.locator('article[data-claim-predicate="batchCode"]').filter({ hasText: "Meridian Biosciences" }).first();
  if (await batchClaim.count()) {
    await batchClaim.getByRole("button", { name: "Approve and publish" }).click();
    await staffPage.getByRole("heading", { name: "Publication ledger" }).waitFor();
  }
}
await staffPage.goto(`${baseURL}/admin/opportunities`, { waitUntil: "networkidle", timeout: 30_000 });
await staffPage.getByRole("button", { name: "Recompute market" }).click();
await staffPage.getByText(/Evaluated .* market conditions/i).waitFor();

for (const [name, route] of [
  ["admin-overview-desktop.png", "/admin"],
  ["admin-sources-desktop.png", "/admin/sources"],
  ["admin-ingest-desktop.png", "/admin/ingest"],
  ["admin-review-desktop.png", "/admin/review"],
  ["admin-opportunities-desktop.png", "/admin/opportunities?status=all"],
  ["admin-traces-desktop.png", "/admin/traces"],
  ["admin-publications-desktop.png", "/admin/publications"],
  ["admin-runs-desktop.png", "/admin/runs"],
]) {
  await staffPage.goto(`${baseURL}${route}`, { waitUntil: "networkidle", timeout: 30_000 });
  await staffPage.screenshot({ path: `audits/screenshots/${name}`, fullPage: true });
}
await staffContext.close();

const populatedPublicContext = await browser.newContext();
await capture("operations-desktop.png", "/operations", { width: 1440, height: 1100 }, populatedPublicContext);
await capture("signals-desktop.png", "/signals", { width: 1440, height: 1100 }, populatedPublicContext);
await capture("signals-mobile.png", "/signals", { width: 390, height: 844 }, populatedPublicContext);
await populatedPublicContext.close();
await browser.close();

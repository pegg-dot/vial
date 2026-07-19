import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

const systemChromium = process.env.PLAYWRIGHT_CHROMIUM_PATH
  ?? (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "audits/playwright-report", open: "never" }]],
  webServer: {
    command: "NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000 VIAL_PGLITE_MEMORY=true VIAL_ALLOW_EMBEDDED_DB_FOR_TESTS=true VIAL_SEED_FIXTURES=true VIAL_SEED_DEMO_ACCOUNTS=true VIAL_SESSION_SECRET=vial-e2e-session-secret-at-least-32-characters VIAL_PRIVACY_HASH_SECRET=vial-e2e-privacy-secret-at-least-32-characters npm run start -- --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000",
    timeout: 120_000,
    reuseExistingServer: true,
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      ...(systemChromium ? { executablePath: systemChromium } : {}),
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

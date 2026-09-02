import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

const systemChromium = process.env.PLAYWRIGHT_CHROMIUM_PATH
  ?? (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);

// The e2e server port. Overridable because :3000 is not reliably free on every dev machine
// (a Docker container holding it makes reuseExistingServer test the WRONG app entirely).
const port = Number(process.env.VIAL_E2E_PORT ?? 3000);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "audits/playwright-report", open: "never" }]],
  webServer: {
    command: `NEXT_PUBLIC_SITE_URL=http://localhost:${port} VIALGRADE_PGLITE_MEMORY=true VIALGRADE_ALLOW_EMBEDDED_DB_FOR_TESTS=true VIALGRADE_SEED_FIXTURES=true VIALGRADE_SEED_DEMO_ACCOUNTS=true VIALGRADE_SESSION_SECRET=vial-e2e-session-secret-at-least-32-characters VIALGRADE_PRIVACY_HASH_SECRET=vial-e2e-privacy-secret-at-least-32-characters npm run start -- --port ${port}`,
    url: `http://localhost:${port}`,
    timeout: 120_000,
    reuseExistingServer: true,
  },
  use: {
    baseURL: `http://localhost:${port}`,
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

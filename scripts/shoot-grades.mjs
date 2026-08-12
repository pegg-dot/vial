// Step 2 of the grade screenshot flow: shoot the vendor pages picked by pick-grade-samples.mjs.
// Runs against `next dev` on the real file-backed database — production mode deliberately
// refuses an embedded database, and that guard should not be worked around for a screenshot.
import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const outDir = process.env.VIALGRADE_SHOT_DIR ?? "audits/screenshots/grade";
const port = Number(process.env.VIALGRADE_SHOT_PORT ?? 3419);
const base = `http://127.0.0.1:${port}`;
await mkdir(outDir, { recursive: true });
const picks = JSON.parse(await readFile(`${outDir}/picks.json`, "utf8"));

const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--webpack", "-p", String(port)],
  {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NEXT_PUBLIC_SITE_URL: base, VIALGRADE_PGLITE_PATH: ".data/pglite", VIALGRADE_SEED_FIXTURES: "false", VIALGRADE_SEED_DEMO_ACCOUNTS: "false" },
  },
);
let log = "";
server.stdout.on("data", d => { log += d; });
server.stderr.on("data", d => { log += d; });

async function waitForReady(deadlineMs = 120_000) {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`dev server exited (${server.exitCode})\n${log}`);
    try {
      const r = await fetch(base, { signal: AbortSignal.timeout(5000) });
      if (r.status < 500) return;
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`dev server never became ready\n${log.slice(-2000)}`);
}

let browser;
try {
  await waitForReady();
  console.log(`dev server up at ${base}\n`);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1150 } });
  for (const [letter, v] of Object.entries(picks)) {
    const page = await context.newPage();
    await page.goto(`${base}/vendors/${v.slug}`, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(1200);
    const file = `${outDir}/${letter.replace(/[^a-z0-9]/gi, "")}-${v.slug}.png`;
    await page.screenshot({ path: file });
    console.log(`  shot ${letter.padEnd(9)} ${v.name} → ${file}`);
    await page.close();
  }
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
  await Promise.race([new Promise(r => server.once("exit", r)), new Promise(r => setTimeout(r, 5000))]);
  if (server.exitCode === null) server.kill("SIGKILL");
}
process.exit(0);

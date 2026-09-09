import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

rmSync(".next", { recursive: true, force: true });

const env = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED ?? "1",
};

const realDatabaseKeys = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "DATABASE_POSTGRES_PRISMA_URL",
  "PGHOST",
  "PGUSER",
  "PGPASSWORD",
  "PGDATABASE",
];

// A Vercel Preview is a disposable review environment, not production. Preview had inherited a
// DATABASE_URL but not the production-only secrets, which made every PR deployment fail the
// production contract. Worse, letting a preview build keep an inherited DB handle would make a
// code-review deployment capable of reading or mutating that database during prerendering.
//
// Make the boundary structural: preview builds have no real database handle and use the same
// isolated in-memory store as tests/local build-time rendering. The runtime DB chooser applies the
// same rule, so this is not only a build-time cosmetic fix.
const isVercelPreview = env.VERCEL_ENV === "preview" || env.VERCEL_TARGET_ENV === "preview";
if (isVercelPreview) {
  for (const key of realDatabaseKeys) delete env[key];
  env.NEXT_PUBLIC_SITE_URL = env.VERCEL_URL?.trim()
    ? `https://${env.VERCEL_URL.trim()}`
    : "http://127.0.0.1:3000";
  env.VIALGRADE_PGLITE_MEMORY = "true";
  env.VIALGRADE_ALLOW_EMBEDDED_DB_FOR_TESTS = "true";
  env.VIALGRADE_SEED_FIXTURES = "true";
  env.VIALGRADE_SEED_DEMO_ACCOUNTS = "true";
  env.VIALGRADE_SESSION_SECRET = "preview-build-session-secret-at-least-32-characters";
  env.VIALGRADE_PRIVACY_HASH_SECRET = "preview-build-privacy-secret-at-least-32-characters";
  env.VIALGRADE_LIVE_INGEST_APPROVED = "false";
  env.VIALGRADE_COMMERCE_MODE = "sandbox";
  env.VIALGRADE_PAYMENT_PROVIDER = "mock";
  env.VIALGRADE_LIVE_COMMERCE_ENABLED = "false";
}

// TypeScript is an explicit release gate. Running it here lets the Next build
// skip its duplicate worker, which can hang in constrained CI/container
// environments after compilation even when `tsc --noEmit` has already passed.
const typecheck = spawnSync(
  process.execPath,
  ["node_modules/typescript/bin/tsc", "--noEmit"],
  { stdio: "inherit", env },
);
if (typecheck.error) throw typecheck.error;
if (typecheck.status !== 0) process.exit(typecheck.status ?? 1);
env.VIALGRADE_SKIP_NEXT_TYPECHECK = "1";

// Local and CI builds without managed PostgreSQL use the embedded, in-memory
// database only to render static/server pages. Deployed runtimes still fail
// closed unless DATABASE_URL and production secrets are present.
//
// A DEPLOYED PRODUCTION build (DATABASE_URL present outside Vercel Preview) must prove its
// environment before it bakes anything in. NEXT_PUBLIC_SITE_URL is inlined at build time, so a
// missing canonical origin can damage every generated canonical/share URL. A missing privacy salt
// is worse: visitor hashes lose their intended secret. Both are release failures, not warnings.
//
// Vercel's Git integration is currently the production authority. GitHub Actions runs a larger
// independent verification suite, while its CLI deployment job is opt-in. That means this file is
// the gate that necessarily executes on the path capable of making a Git commit live.
//
// Unit only, deliberately: fast, no browser, no real database. The integration suite is NOT run
// here. It would need DATABASE_URL stripped from a build whose whole purpose is having one, and
// databaseChoice refuses a process that asks for both a real database and the isolated test store.
// E2E needs a browser. Both stay in the larger local/CI gate (`npm run verify`).
if (env.DATABASE_URL?.trim()) {
  // A production build has production credentials in its environment. The unit suite must not.
  // Earlier versions stripped only DATABASE_URL, which still handed tests the real privacy salt,
  // admin password, webhooks, API keys and other live capability flags. Build a deliberately
  // sterile child environment instead: no handle on production data, no live network/payment
  // capability, and explicit test-only secrets.
  const suiteEnv = { ...env };
  for (const key of [
    ...realDatabaseKeys,
    "CRON_SECRET",
    "VIALGRADE_MCP_SELLER_TOKEN",
    "VIALGRADE_MCP_LAB_TOKEN",
    "STRIPE_SECRET_KEY",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_CONNECT_CLIENT_ID",
    "VIALGRADE_LIVE_COMMERCE_ACK",
    "ANTHROPIC_API_KEY",
    "VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
    "VIALGRADE_ALERT_WEBHOOK",
    "VIALGRADE_ADMIN_PASSWORD",
  ]) delete suiteEnv[key];

  suiteEnv.NODE_ENV = "test";
  suiteEnv.NEXT_PUBLIC_SITE_URL = "http://127.0.0.1:3000";
  suiteEnv.VIALGRADE_PGLITE_MEMORY = "true";
  suiteEnv.VIALGRADE_ALLOW_EMBEDDED_DB_FOR_TESTS = "false";
  suiteEnv.VIALGRADE_SEED_FIXTURES = "true";
  suiteEnv.VIALGRADE_SEED_DEMO_ACCOUNTS = "true";
  suiteEnv.VIALGRADE_SESSION_SECRET = "build-suite-session-secret-at-least-32-characters";
  suiteEnv.VIALGRADE_PRIVACY_HASH_SECRET = "build-suite-privacy-secret-at-least-32-characters";
  suiteEnv.VIALGRADE_LIVE_INGEST_APPROVED = "false";
  suiteEnv.VIALGRADE_COMMERCE_MODE = "sandbox";
  suiteEnv.VIALGRADE_PAYMENT_PROVIDER = "mock";
  suiteEnv.VIALGRADE_LIVE_COMMERCE_ENABLED = "false";

  const suite = spawnSync(
    process.execPath,
    ["node_modules/vitest/vitest.mjs", "run", "tests/unit", "--maxWorkers=1", "--no-file-parallelism"],
    { stdio: "inherit", env: suiteEnv },
  );
  if (suite.status !== 0) {
    console.error("\nRefusing to build: the unit suite is red. This commit will not deploy.");
    process.exit(suite.status ?? 1);
  }
}

if (env.DATABASE_URL?.trim()) {
  const check = spawnSync(process.execPath, ["scripts/check-env.mjs"], { stdio: "inherit", env });
  if (check.status !== 0) {
    console.error("\nRefusing to build: the production environment is incomplete (see above).");
    process.exit(check.status ?? 1);
  }
}

if (!env.DATABASE_URL?.trim()) {
  env.NEXT_PUBLIC_SITE_URL ??= "http://127.0.0.1:3000";
  env.VIALGRADE_PGLITE_MEMORY = "true";
  env.VIALGRADE_ALLOW_EMBEDDED_DB_FOR_TESTS = "true";
  env.VIALGRADE_SEED_FIXTURES ??= "true";
  env.VIALGRADE_SEED_DEMO_ACCOUNTS ??= "true";
  env.VIALGRADE_SESSION_SECRET ??= "build-only-session-secret-at-least-32-characters";
  env.VIALGRADE_PRIVACY_HASH_SECRET ??= "build-only-privacy-secret-at-least-32-characters";
}

const result = spawnSync(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build", "--webpack"],
  { stdio: "inherit", env },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);

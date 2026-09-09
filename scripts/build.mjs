import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

rmSync(".next", { recursive: true, force: true });

const env = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED ?? "1",
};

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
// A DEPLOYED build (DATABASE_URL present) must prove its environment before it bakes anything in.
// NEXT_PUBLIC_SITE_URL is inlined at build time, so a missing canonical origin can damage every
// generated canonical/share URL. A missing privacy salt is worse: visitor hashes lose their
// intended secret. Both are release failures, not warnings.
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
  // Build the child env explicitly. Setting a key to `undefined` is not a reliable way to unset it
  // for a spawned process, and leaving BOTH unset would drop the suite onto an on-disk store. The
  // suite wants a real isolated in-memory database and no handle on the production one.
  const suiteEnv = { ...env };
  for (const key of ["DATABASE_URL", "POSTGRES_URL", "DATABASE_POSTGRES_PRISMA_URL", "PGHOST", "PGUSER", "PGPASSWORD", "PGDATABASE"]) delete suiteEnv[key];
  suiteEnv.VIALGRADE_PGLITE_MEMORY = "true";
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

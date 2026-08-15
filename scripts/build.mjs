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
// A DEPLOYED build (DATABASE_URL present) must prove its environment before it bakes anything in.
// scripts/check-env.mjs already existed and was never called, which is how the canonical-URL trap
// stayed open: NEXT_PUBLIC_SITE_URL is inlined at BUILD time, so if it were missing in production
// every page would ship <link rel="canonical" href="http://127.0.0.1:3000/..."> from the fallback
// below and the whole site could be deindexed. A missing privacy salt is worse — visitor hashes
// become reversible. Both fail silently at build and only surface as damage later, so the build is
// the right place to stop.
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

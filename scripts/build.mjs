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

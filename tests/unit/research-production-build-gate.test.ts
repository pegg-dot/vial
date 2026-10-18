import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Vercel production release safety interlock", () => {
  it.each(["production", "preview"])("protects production while keeping %s behavior explicit", (env) => {
    // Running with a production target and missing research-only flag must
    // fail before the script clears .next or invokes any build subprocess.
    const result = spawnSync(process.execPath, ["scripts/build.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 3000,
      env: {
        ...process.env,
        VERCEL_ENV: env,
        VERCEL_TARGET_ENV: "production",
        VIALGRADE_PUBLIC_EVIDENCE_ONLY: "false",
      },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Refusing production build: research-only mode must be explicitly enabled");
    expect(result.stdout).not.toContain("Creating an optimized production build");
  });
});

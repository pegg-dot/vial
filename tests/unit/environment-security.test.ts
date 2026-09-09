import { afterEach, describe, expect, it, vi } from "vitest";
import { getEnvironment, resetEnvironmentForTests } from "@/server/config/env";

function productionEnv() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DATABASE_URL", "postgres://user:pass@db.example/vial?sslmode=verify-full");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://vialgrade.example");
  vi.stubEnv("VIALGRADE_SESSION_SECRET", "session-secret-aaaaaaaaaaaaaaaaaaaa");
  vi.stubEnv("VIALGRADE_PRIVACY_HASH_SECRET", "privacy-secret-bbbbbbbbbbbbbbbbbbbb");
  vi.stubEnv("VIALGRADE_PGLITE_MEMORY", "false");
  vi.stubEnv("VIALGRADE_ALLOW_EMBEDDED_DB_FOR_TESTS", "false");
  resetEnvironmentForTests();
}

afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvironmentForTests();
});

describe("production environment security", () => {
  it("accepts independent secrets and an HTTPS canonical origin", () => {
    productionEnv();
    expect(getEnvironment().NEXT_PUBLIC_SITE_URL).toBe("https://vialgrade.example");
  });

  it("rejects an HTTP canonical origin", () => {
    productionEnv();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://vialgrade.example");
    resetEnvironmentForTests();
    expect(() => getEnvironment()).toThrow(/must use https/i);
  });

  it("rejects reuse of the session secret as the privacy hash secret", () => {
    productionEnv();
    vi.stubEnv("VIALGRADE_PRIVACY_HASH_SECRET", process.env.VIALGRADE_SESSION_SECRET!);
    resetEnvironmentForTests();
    expect(() => getEnvironment()).toThrow(/independent values/i);
  });

  it("rejects a deployed production environment that omitted its canonical origin", () => {
    productionEnv();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    resetEnvironmentForTests();
    expect(() => getEnvironment()).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });
});

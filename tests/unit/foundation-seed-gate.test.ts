import { afterEach, describe, expect, it, vi } from "vitest";
import type { SqlConnection, SqlResult } from "@/server/db/client";
import { seedProductionFoundation } from "@/server/auth/foundation-seed";

// Demo accounts are published fixtures — their passwords are printed in README.md and
// docs/HANDOFF.md — and one of them, jon@vialgrade.test, holds the `administrator` role.
//
// The gate was an OR:  NODE_ENV !== "production" || VIALGRADE_SEED_DEMO_ACCOUNTS === "true"
// so the flag *overrode* the production check instead of narrowing it. docker-compose.yml set both
// `NODE_ENV: production` and that flag, which means anyone who ran `docker compose up` from this
// public repository got a durable Postgres volume seeded with a working administrator login whose
// password is in the README. Not a data leak — a published admin account.
//
// The invariant under test is therefore: a production runtime with a durable database seeds nothing,
// no matter what the flag says.

function recordingDb() {
  const queries: string[] = [];
  const db: SqlConnection = {
    async query<T extends Record<string, unknown>>(text: string): Promise<SqlResult<T>> {
      queries.push(text);
      return { rows: [] as T[], rowCount: 0 };
    },
  };
  return { db, queries };
}

/** Sets every input the gate reads, so no test inherits another's environment. */
function environment(options: { nodeEnv: string; flag?: string; databaseUrl?: string; memory?: string; embedded?: string }) {
  vi.stubEnv("NODE_ENV", options.nodeEnv);
  vi.stubEnv("VIALGRADE_SEED_DEMO_ACCOUNTS", options.flag ?? "");
  vi.stubEnv("DATABASE_URL", options.databaseUrl ?? "");
  vi.stubEnv("VIALGRADE_PGLITE_MEMORY", options.memory ?? "");
  vi.stubEnv("VIALGRADE_ALLOW_EMBEDDED_DB_FOR_TESTS", options.embedded ?? "");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("demo account seeding gate", () => {
  it("seeds nothing in a production runtime with a durable database, even with the flag set", async () => {
    // This is exactly the docker-compose.yml configuration that shipped.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    environment({ nodeEnv: "production", flag: "true", databaseUrl: "postgres://vialgrade:pw@postgres:5432/vialgrade" });
    const { db, queries } = recordingDb();
    await seedProductionFoundation(db);
    expect(queries).toHaveLength(0);
  });

  it("seeds nothing in a production runtime even when the flag is set and no DATABASE_URL is present", async () => {
    // A production build pointed at an on-disk PGlite store is still durable.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    environment({ nodeEnv: "production", flag: "true" });
    const { db, queries } = recordingDb();
    await seedProductionFoundation(db);
    expect(queries).toHaveLength(0);
  });

  it("warns loudly rather than silently ignoring an operator's flag", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    environment({ nodeEnv: "production", flag: "true", databaseUrl: "postgres://x/y" });
    await seedProductionFoundation(recordingDb().db);
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0]?.[0])).toContain("VIALGRADE_SEED_DEMO_ACCOUNTS");
  });

  it("still seeds outside production, which is what dev and the integration suite rely on", async () => {
    environment({ nodeEnv: "development" });
    const { db, queries } = recordingDb();
    await seedProductionFoundation(db);
    expect(queries.some((q) => q.includes("INSERT INTO auth_users"))).toBe(true);
  });

  it("still seeds the e2e harness: a production build against an in-memory database, flag set", async () => {
    // `next start` forces NODE_ENV=production, so the e2e run is a production runtime — but its
    // database is `memory://` and vanishes with the process, and server/config/env.ts already
    // refuses VIALGRADE_ALLOW_EMBEDDED_DB_FOR_TESTS unless the site URL is loopback too.
    environment({ nodeEnv: "production", flag: "true", memory: "true", embedded: "true" });
    const { db, queries } = recordingDb();
    await seedProductionFoundation(db);
    expect(queries.some((q) => q.includes("INSERT INTO auth_users"))).toBe(true);
  });

  it("requires the flag on that ephemeral path — the escape hatch is not a second default", async () => {
    environment({ nodeEnv: "production", memory: "true", embedded: "true" });
    const { db, queries } = recordingDb();
    await seedProductionFoundation(db);
    expect(queries).toHaveLength(0);
  });

  it("bites: the old OR gate would have seeded the docker configuration", () => {
    const oldGate = (nodeEnv: string, flag: string) => nodeEnv !== "production" || flag === "true";
    expect(oldGate("production", "true")).toBe(true); // what shipped: production + flag → seeded
  });
});

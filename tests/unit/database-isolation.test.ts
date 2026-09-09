import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { databaseChoice } from "@/server/db/client";

// The client checked DATABASE_URL before the in-memory flag, and the isolated test runner handed
// its children `{...process.env}` without stripping it. Together that meant running the integration
// suite on any machine with DATABASE_URL exported pointed it at that database — and on a deploy
// machine, DATABASE_URL is production. Nothing had ever failed, because nobody had happened to run
// the suite with one exported. That is not safety, it is luck.
//
// Both readings of the pair are bad, so neither is chosen.

describe("choosing a database", () => {
  it("refuses when an isolated run also has a real database in scope", () => {
    expect(() => databaseChoice({ DATABASE_URL: "postgres://u:p@db.example.com/prod", VIALGRADE_PGLITE_MEMORY: "true" }))
      .toThrow(/Refusing to open a database/);
  });

  // An error that does not name the fix is just an obstacle.
  it("names both settings and says to unset one", () => {
    let message = "";
    try { databaseChoice({ DATABASE_URL: "postgres://x", VIALGRADE_PGLITE_MEMORY: "true" }); }
    catch (error) { message = (error as Error).message; }
    expect(message).toContain("VIALGRADE_PGLITE_MEMORY");
    expect(message).toContain("DATABASE_URL");
    expect(message).toContain("Unset one");
  });

  // Controls. Each alone is an ordinary configuration and must keep working, or the guard is
  // breakage wearing a safety label.
  it("uses the real database when only that is set", () => {
    expect(databaseChoice({ DATABASE_URL: "postgres://u:p@db/prod" })).toEqual({ kind: "postgres", url: "postgres://u:p@db/prod" });
  });

  it("uses memory when only the isolation flag is set", () => {
    expect(databaseChoice({ VIALGRADE_PGLITE_MEMORY: "true" })).toEqual({ kind: "memory" });
  });

  it("falls back to an on-disk store when neither is set", () => {
    expect(databaseChoice({}).kind).toBe("file");
    expect(databaseChoice({ VIALGRADE_PGLITE_PATH: "/tmp/somewhere" })).toEqual({ kind: "file", dir: "/tmp/somewhere" });
  });

  // "true" is the only spelling that means isolation. A stray "1" must not silently open a real
  // database in a run that believed it was isolated.
  it("treats only the exact flag value as a request for isolation", () => {
    expect(() => databaseChoice({ DATABASE_URL: "postgres://x", VIALGRADE_PGLITE_MEMORY: "1" })).not.toThrow();
    expect(databaseChoice({ VIALGRADE_PGLITE_MEMORY: "1" }).kind).toBe("file");
  });

  it("forces Vercel Preview onto memory even when DATABASE_URL leaked into its environment", () => {
    expect(databaseChoice({
      VERCEL_ENV: "preview",
      DATABASE_URL: "postgres://u:p@db.example.com/prod",
    })).toEqual({ kind: "memory" });
  });
});

// The runner is what used to present the bad combination. Assert it still strips them rather than
// trusting that it does.
describe("the isolated runner hands its children a clean environment", () => {
  it("deletes every real-database handle before spawning", () => {
    const src = readFileSync(new URL("../../scripts/run-isolated-tests.mjs", import.meta.url), "utf8");
    for (const key of ["DATABASE_URL", "POSTGRES_URL", "PGHOST", "PGPASSWORD"]) expect(src).toContain(key);
    expect(src).toMatch(/delete env\[key\]/);
  });
});

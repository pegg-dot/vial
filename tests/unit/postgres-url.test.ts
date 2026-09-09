import { describe, expect, it } from "vitest";
import { normalizePostgresUrl } from "@/server/db/postgres-url";

describe("PostgreSQL connection security", () => {
  it.each(["prefer", "require", "verify-ca"])("pins sslmode=%s to verify-full", (mode) => {
    const normalized = new URL(
      normalizePostgresUrl(`postgres://user:pass@db.example/vial?sslmode=${mode}&application_name=vialgrade`),
    );

    expect(normalized.searchParams.get("sslmode")).toBe("verify-full");
    expect(normalized.searchParams.get("application_name")).toBe("vialgrade");
  });

  it("preserves explicit verify-full", () => {
    const normalized = new URL(
      normalizePostgresUrl("postgres://user:pass@db.example/vial?sslmode=verify-full"),
    );

    expect(normalized.searchParams.get("sslmode")).toBe("verify-full");
  });

  it("does not invent an SSL mode when the connection string omits one", () => {
    const normalized = new URL(normalizePostgresUrl("postgres://user:pass@db.example/vial"));
    expect(normalized.searchParams.has("sslmode")).toBe(false);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { CURRENT_SCHEMA_VERSION } from "@/server/db/migrations";

// A public standards layer is a contract: its schema must not silently drift from what
// migrations actually apply. This guard fails if a version is bumped without a registered
// migration, if versions are non-contiguous, or if a standard table is missing.
describe("migration integrity (contract discipline)", () => {
  beforeEach(async () => {
    process.env.VIAL_PGLITE_MEMORY = "true";
    process.env.VIAL_SEED_FIXTURES = "true";
    await resetDatabaseForTests();
  });

  it("applies a contiguous 1..CURRENT set of migrations with no gaps", async () => {
    const db = await getDatabase();
    const versions = (await db.query<{ version: number }>(`SELECT version FROM schema_migrations ORDER BY version`)).rows.map(r => Number(r.version));
    expect(versions.length).toBe(CURRENT_SCHEMA_VERSION);
    expect(versions).toEqual(Array.from({ length: CURRENT_SCHEMA_VERSION }, (_, i) => i + 1));
  });

  it("materializes the 10.0 standard tables", async () => {
    const db = await getDatabase();
    const tableExists = async (name: string) => Number((await db.query<{ n: string | number }>(`SELECT COUNT(*) n FROM information_schema.tables WHERE table_name=$1`, [name])).rows[0]!.n) > 0;
    expect(await tableExists("registry_identifiers")).toBe(true);
    expect(await tableExists("registry_identifier_aliases")).toBe(true);
    expect(await tableExists("passport_versions")).toBe(true);
    // The confidence decomposition column must be present on batch_passports.
    const columnExists = Number((await db.query<{ n: string | number }>(`SELECT COUNT(*) n FROM information_schema.columns WHERE table_name='batch_passports' AND column_name='confidence_basis'`)).rows[0]!.n);
    expect(columnExists).toBe(1);
  });
});

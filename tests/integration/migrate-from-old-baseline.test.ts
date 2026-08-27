import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { CURRENT_SCHEMA_VERSION, runMigrations } from "@/server/db/migrations";

// The failure this exists to prevent, which happened in production:
//
// `consumerIntelligenceSchemaSql` is registered as migration version 5. Columns were ADDED to that
// module months after version 5 had been applied to production, and `runMigrations` skips any
// version already in `schema_migrations` — so the new `ALTER TABLE ... ADD COLUMN` statements never
// ran there. The code shipped, the deploy went green, and three columns simply did not exist.
//
// Every other test in this repository builds its database from zero, where version 5 runs WITH the
// new columns in it. That is precisely why the whole suite stayed green while production broke: a
// suite that always starts from nothing can never see a migration it failed to re-register.
//
// So this test starts from an OLD database instead — it applies the migrations, pretends to be a
// deployment that stopped at an earlier version, and then requires the current migration set to
// bring it fully up to date.

/** Columns the running code reads that were added to already-applied migration modules. */
const REQUIRED_COLUMNS: Array<{ table: string; column: string; why: string }> = [
  { table: "user_notification_preferences", column: "availability_alerts", why: "governs availability + shipping alerts" },
  { table: "user_notifications", column: "pushed_at", why: "stops the sweep re-pushing every alert forever" },
  { table: "user_visit_state", column: "notification_swept_at", why: "stops the sweep queue starving" },
];

/**
 * Indexes the running code depends on that were added to an already-applied migration module.
 *
 * Same trap as the columns above, and just as invisible: `externalDataSchemaSql` is registered at
 * version 30. Adding `idx_news_date` to that module creates it on every database built from zero —
 * which is every test and every new deployment — and never on production, which recorded version 30
 * long ago. A missing index does not throw, so nothing anywhere would have said a word: /news is
 * force-dynamic and would simply sort the whole table on every render, forever.
 */
const REQUIRED_INDEXES: Array<{ table: string; index: string; why: string }> = [
  { table: "news_items", index: "idx_news_date", why: "serves /news, which orders every render by news_date DESC NULLS LAST" },
];

/** The narrow slice of SqlConnection runMigrations actually uses, typed so `db` is not self-referential. */
interface MigrationDb {
  query<T>(text: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }>;
  transaction<T>(fn: (tx: MigrationDb) => Promise<T>): Promise<T>;
  dialect: "postgres";
}

async function freshDb() {
  const pg = new PGlite();
  const db: MigrationDb = {
    async query<T>(text: string, params: unknown[] = []) {
      const result = await pg.query(text, params as never[]);
      return { rows: (result.rows ?? []) as T[], rowCount: result.rows?.length ?? 0 };
    },
    async transaction<T>(fn: (tx: MigrationDb) => Promise<T>) { return fn(db); },
    dialect: "postgres",
  };
  return { pg, db };
}

async function indexExists(db: MigrationDb, table: string, index: string) {
  const rows = (await db.query<{ n: string }>(
    `SELECT COUNT(*) n FROM pg_indexes WHERE tablename=$1 AND indexname=$2`,
    [table, index],
  )).rows;
  return Number(rows[0]?.n ?? 0) > 0;
}

async function columnExists(db: MigrationDb, table: string, column: string) {
  const rows = (await db.query<{ n: string }>(
    `SELECT COUNT(*) n FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`,
    [table, column],
  )).rows;
  return Number(rows[0]?.n ?? 0) > 0;
}

describe("a database that already ran an older migration set still catches up", () => {
  it("brings an old deployment fully up to date", async () => {
    const { pg, db } = await freshDb();
    try {
      await runMigrations(db as never);

      // Pretend this database is an older production: it has the tables, and its ledger claims
      // every version through 50 was applied — which is exactly the state that hid the bug.
      await db.query(`DELETE FROM schema_migrations WHERE version > 50`);
      for (const { table, column } of REQUIRED_COLUMNS) {
        await db.query(`ALTER TABLE ${table} DROP COLUMN IF EXISTS ${column}`);
        expect(await columnExists(db, table, column), `${table}.${column} should be gone for this simulation`).toBe(false);
      }
      for (const { table, index } of REQUIRED_INDEXES) {
        await db.query(`DROP INDEX IF EXISTS ${index}`);
        expect(await indexExists(db, table, index), `${index} should be gone for this simulation`).toBe(false);
      }

      // Deploy today's code against it.
      await runMigrations(db as never);

      for (const { table, column, why } of REQUIRED_COLUMNS) {
        expect(
          await columnExists(db, table, column),
          `${table}.${column} is missing after migrating an old database — it ${why}, and the code that reads it will throw in production. It was added to a schema module whose migration version had already been applied, so it needs a NEW version registered in migrations.ts.`,
        ).toBe(true);
      }

      for (const { table, index, why } of REQUIRED_INDEXES) {
        expect(
          await indexExists(db, table, index),
          `${index} on ${table} is missing after migrating an old database — it ${why}. Unlike a missing column this fails SILENTLY: the query still returns the right rows, just by sorting the whole table every time. It was added to a schema module whose migration version had already been applied, so it needs a NEW version registered in migrations.ts.`,
        ).toBe(true);
      }
    } finally {
      await pg.close();
    }
  });

  it("records the version the code claims to be at", async () => {
    const { pg, db } = await freshDb();
    try {
      await runMigrations(db as never);
      const applied = (await db.query<{ version: number }>(`SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1`)).rows[0];
      expect(
        Number(applied?.version),
        "the highest registered migration must equal CURRENT_SCHEMA_VERSION, or /api/health/ready reports a schema mismatch forever",
      ).toBe(CURRENT_SCHEMA_VERSION);
    } finally {
      await pg.close();
    }
  });

  it("is idempotent — running the current set twice changes nothing", async () => {
    const { pg, db } = await freshDb();
    try {
      await runMigrations(db as never);
      const before = (await db.query<{ n: string }>(`SELECT COUNT(*) n FROM schema_migrations`)).rows[0];
      await runMigrations(db as never);
      const after = (await db.query<{ n: string }>(`SELECT COUNT(*) n FROM schema_migrations`)).rows[0];
      expect(Number(after?.n)).toBe(Number(before?.n));
    } finally {
      await pg.close();
    }
  });
});

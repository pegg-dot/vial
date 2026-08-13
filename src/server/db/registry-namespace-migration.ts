import type { SqlConnection } from "./client";
import { newId } from "./ids";
import { normalizeTerm } from "@/server/market-data/normalize";

// The public identifier namespace before the VialGrade rename. Databases provisioned
// earlier hold both the old column name (`vial_id`) and the old value prefix (`vial:`).
export const LEGACY_ID_PREFIX = "vial:";
export const REGISTRY_ID_PREFIX = "vialgrade:";

async function hasColumn(db: SqlConnection, table: string, column: string): Promise<boolean> {
  const rows = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`,
    [table, column],
  );
  return rows.rows.length > 0;
}

// The alias FK points at the identifier primary key, so rewriting that key is blocked
// unless the constraint cascades. Pre-rename databases created it without ON UPDATE
// CASCADE, so it is rebuilt here rather than assumed.
async function ensureCascadingAliasFk(db: SqlConnection) {
  const constraint = await db.query<{ constraint_name: string }>(
    `SELECT tc.constraint_name FROM information_schema.table_constraints tc
     WHERE tc.table_name='registry_identifier_aliases' AND tc.constraint_type='FOREIGN KEY'`,
  );
  for (const row of constraint.rows) {
    await db.query(`ALTER TABLE registry_identifier_aliases DROP CONSTRAINT ${row.constraint_name}`);
  }
  await db.query(
    `ALTER TABLE registry_identifier_aliases
     ADD CONSTRAINT registry_identifier_aliases_registry_id_fkey
     FOREIGN KEY (registry_id) REFERENCES registry_identifiers(registry_id) ON DELETE CASCADE ON UPDATE CASCADE`,
  );
}

function migratedId(legacyId: string): string {
  return `${REGISTRY_ID_PREFIX}${legacyId.slice(LEGACY_ID_PREFIX.length)}`;
}

/**
 * Moves the public identifier registry from the `vial:` namespace to `vialgrade:`.
 *
 * The registry's contract is that a citation to a former identifier still resolves, so
 * this never silently overwrites: every rewritten key is recorded as a `former-id` alias
 * first. Idempotent — a second run finds no legacy rows and does nothing.
 */
export async function migrateRegistryNamespace(db: SqlConnection): Promise<{ renamedColumns: boolean; rewritten: number }> {
  let renamedColumns = false;

  // 1. Column rename. `registry_id` is deliberately brand-free so a future rename of the
  //    product never has to touch the schema again.
  if (await hasColumn(db, "registry_identifiers", "vial_id")) {
    await db.query(`ALTER TABLE registry_identifiers RENAME COLUMN vial_id TO registry_id`);
    renamedColumns = true;
  }
  if (await hasColumn(db, "registry_identifier_aliases", "vial_id")) {
    await db.query(`ALTER TABLE registry_identifier_aliases RENAME COLUMN vial_id TO registry_id`);
    renamedColumns = true;
  }

  const legacy = (await db.query<{ registry_id: string }>(
    `SELECT registry_id FROM registry_identifiers WHERE registry_id LIKE $1 ORDER BY registry_id`,
    [`${LEGACY_ID_PREFIX}%`],
  )).rows;

  // A target key already occupied by a `vialgrade:` row would abort the whole boot transaction on
  // a primary-key violation, with no way to recover. Fail with something a human can act on.
  if (legacy.length > 0) {
    const collisions = (await db.query<{ registry_id: string }>(
      `SELECT registry_id FROM registry_identifiers WHERE registry_id = ANY($1)`,
      [legacy.map(row => migratedId(row.registry_id))],
    )).rows;
    if (collisions.length > 0) {
      throw new Error(
        `registry namespace migration aborted: ${collisions.length} target identifier(s) already exist in the vialgrade namespace ` +
        `(e.g. ${collisions[0]!.registry_id}). This database holds BOTH namespaces — reconcile the duplicates before migrating.`,
      );
    }
    await ensureCascadingAliasFk(db);
  }

  for (const { registry_id: legacyId } of legacy) {
    const nextId = migratedId(legacyId);

    // Record the former identifier BEFORE the key moves, so a crash mid-migration leaves
    // a resolvable alias rather than an orphaned citation.
    await db.query(
      `INSERT INTO registry_identifier_aliases(id,registry_id,alias,normalized_alias,alias_type)
       VALUES($1,$2,$3,$4,'former-id') ON CONFLICT(registry_id,normalized_alias) DO NOTHING`,
      [newId("regalias"), legacyId, legacyId, normalizeTerm(legacyId)],
    );

    // The alias rows follow the key via ON UPDATE CASCADE.
    await db.query(`UPDATE registry_identifiers SET registry_id=$2,updated_at=NOW() WHERE registry_id=$1`, [legacyId, nextId]);
  }

  // Redirect tombstones point at an identifier by value, not by foreign key, so they do not
  // cascade — a missed one would 404 every citation of a merged record. This runs even when there
  // were no legacy keys left to rewrite: a prior partial run can leave keys moved but pointers
  // stale, and an early return here made this step unreachable on exactly that database.
  // Rewritten in JS, not with SQL string functions: a bound offset makes SUBSTRING return NULL,
  // and `'vialgrade:' || NULL` is NULL, which silently erases the redirect instead of moving it.
  const tombstones = (await db.query<{ registry_id: string; redirects_to: string }>(
    `SELECT registry_id,redirects_to FROM registry_identifiers WHERE redirects_to LIKE $1`,
    [`${LEGACY_ID_PREFIX}%`],
  )).rows;
  for (const tombstone of tombstones) {
    await db.query(
      `UPDATE registry_identifiers SET redirects_to=$2 WHERE registry_id=$1`,
      [tombstone.registry_id, migratedId(tombstone.redirects_to)],
    );
  }

  return { renamedColumns, rewritten: legacy.length };
}

import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabaseForTests, getDatabase } from "@/server/db/client";
import { migrateRegistryNamespace } from "@/server/db/registry-namespace-migration";
import { getRegistryRecord, resolveToRegistry, mintRegistryId } from "@/server/registry/repository";

beforeEach(async () => {
  process.env.VIALGRADE_PGLITE_MEMORY = "true";
  process.env.VIALGRADE_SEED_FIXTURES = "true";
  process.env.VIALGRADE_SEED_DEMO_ACCOUNTS = "true";
  delete (globalThis as { __vialEvidenceSeedPromise?: unknown }).__vialEvidenceSeedPromise;
  delete (globalThis as { __vialSellerOpsSeedPromise?: unknown }).__vialSellerOpsSeedPromise;
  await resetDatabaseForTests();
});

// Inserts a row carrying the PRE-rename identifier shape (`vial:…`), which is what a
// database provisioned before the VialGrade rename actually contains.
async function seedLegacyRow(id: string, slug: string) {
  const db = await getDatabase();
  await db.query(
    `INSERT INTO registry_identifiers(registry_id,entity_type,source_entity_type,source_entity_id,display_name,canonical_slug,provenance_url)
     VALUES($1,'vendor','organization',$2,$3,$4,$5)`,
    [id, `org:${slug}`, slug.replace(/-/g, " "), slug, `/vendors/${slug}`],
  );
  return db;
}

describe("registry namespace migration (vial: → vialgrade:)", () => {
  it("rewrites legacy identifiers to the vialgrade namespace", async () => {
    const db = await seedLegacyRow("vial:vendor:legacy-co", "legacy-co");

    await migrateRegistryNamespace(db);

    const rows = await db.query<{ registry_id: string }>(
      `SELECT registry_id FROM registry_identifiers WHERE canonical_slug='legacy-co'`,
    );
    expect(rows.rows[0]!.registry_id).toBe("vialgrade:vendor:legacy-co");
  });

  // The registry's stated guarantee is that citations to a former identifier still
  // resolve. A brand rename must not be the one event that breaks it.
  it("keeps every pre-rename citation resolvable", async () => {
    const db = await seedLegacyRow("vial:vendor:cited-co", "cited-co");

    await migrateRegistryNamespace(db);

    const byOldId = await getRegistryRecord("vial:vendor:cited-co");
    expect(byOldId).toBeTruthy();
    expect(byOldId!.registryId).toBe("vialgrade:vendor:cited-co");

    const resolved = await resolveToRegistry("vial:vendor:cited-co", "vendor");
    expect(resolved.best?.registryId).toBe("vialgrade:vendor:cited-co");
  });

  it("records the former identifier as an alias, not a silent overwrite", async () => {
    const db = await seedLegacyRow("vial:vendor:aliased-co", "aliased-co");

    await migrateRegistryNamespace(db);

    const record = await getRegistryRecord("vialgrade:vendor:aliased-co");
    expect(record!.aliases).toContain("vial:vendor:aliased-co");
  });

  it("is idempotent — a second run rewrites nothing and grows no aliases", async () => {
    const db = await seedLegacyRow("vial:vendor:idem-co", "idem-co");

    await migrateRegistryNamespace(db);
    const first = await getRegistryRecord("vialgrade:vendor:idem-co");

    await migrateRegistryNamespace(db);
    const second = await getRegistryRecord("vialgrade:vendor:idem-co");

    expect(second!.registryId).toBe(first!.registryId);
    expect(second!.aliases.length).toBe(first!.aliases.length);
  });

  it("carries redirect tombstones across the namespace too", async () => {
    const db = await seedLegacyRow("vial:vendor:tomb-co", "tomb-co");
    await seedLegacyRow("vial:vendor:merge-target", "merge-target");
    await db.query(
      `UPDATE registry_identifiers SET status='redirected',redirects_to='vial:vendor:merge-target' WHERE registry_id='vial:vendor:tomb-co'`,
    );

    await migrateRegistryNamespace(db);

    // Assert the RAW column. Going through getRegistryRecord hides a dangling pointer: its alias
    // fallback resolves the stale `vial:` value via the former-id alias the migration just wrote,
    // so the test passes even when the tombstone rewrite does nothing at all.
    const raw = await db.query<{ redirects_to: string | null }>(
      `SELECT redirects_to FROM registry_identifiers WHERE registry_id='vialgrade:vendor:tomb-co'`,
    );
    expect(raw.rows[0]!.redirects_to).toBe("vialgrade:vendor:merge-target");

    const record = await getRegistryRecord("vialgrade:vendor:tomb-co");
    expect(record!.registryId).toBe("vialgrade:vendor:merge-target");
  });

  // A database provisioned before the rename carries the OLD column name as well as the
  // old values. Renaming a primary key that an alias FK points at is the step most likely
  // to fail in production, so it is exercised against a genuinely legacy-shaped table.
  it("renames the legacy vial_id column on a pre-rename database", async () => {
    const db = await getDatabase();
    await db.query(`ALTER TABLE registry_identifier_aliases RENAME COLUMN registry_id TO vial_id`);
    await db.query(`ALTER TABLE registry_identifiers RENAME COLUMN registry_id TO vial_id`);

    await migrateRegistryNamespace(db);

    const columns = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name IN ('registry_identifiers','registry_identifier_aliases') AND column_name IN ('vial_id','registry_id')`,
    );
    const names = columns.rows.map(r => r.column_name).sort();
    expect(names).toEqual(["registry_id", "registry_id"]);

    // And the spine still reads through the renamed column.
    const record = await getRegistryRecord("vialgrade:compound:bpc-157");
    expect(record).toBeTruthy();
  });

  // A prior partial run can leave keys moved but a pointer stale. The tombstone step used to sit
  // behind an early return, so it was unreachable on exactly that database.
  it("still repairs a stale redirect when no legacy keys remain", async () => {
    const db = await getDatabase();
    await db.query(
      `INSERT INTO registry_identifiers(registry_id,entity_type,source_entity_type,source_entity_id,display_name,canonical_slug,provenance_url,status,redirects_to)
       VALUES('vialgrade:vendor:half-done','vendor','organization','org:half-done','Half Done','half-done','/vendors/half-done','redirected','vial:vendor:merge-target')`,
    );

    await migrateRegistryNamespace(db);

    const raw = await db.query<{ redirects_to: string | null }>(
      `SELECT redirects_to FROM registry_identifiers WHERE registry_id='vialgrade:vendor:half-done'`,
    );
    expect(raw.rows[0]!.redirects_to).toBe("vialgrade:vendor:merge-target");
  });

  // Both namespaces present means a PK collision mid-transaction, which would abort the entire
  // boot with no recovery. It must fail with a message a human can act on instead.
  it("refuses to migrate a database holding both namespaces", async () => {
    const db = await seedLegacyRow("vial:vendor:dupe-co", "dupe-co");
    await db.query(
      `INSERT INTO registry_identifiers(registry_id,entity_type,source_entity_type,source_entity_id,display_name,canonical_slug,provenance_url)
       VALUES('vialgrade:vendor:dupe-co','vendor','organization','org:dupe-co-2','Dupe Co 2','dupe-co-2','/vendors/dupe-co-2')`,
    );

    await expect(migrateRegistryNamespace(db)).rejects.toThrow(/both namespaces|already exist/i);
  });

  it("leaves already-migrated identifiers untouched", async () => {
    const db = await getDatabase();
    const minted = await mintRegistryId(db, {
      entityType: "compound",
      sourceEntityType: "compound",
      sourceEntityId: "cmp:fresh",
      displayName: "Fresh Compound",
      slug: "fresh-compound",
    });
    expect(minted.registryId).toBe("vialgrade:compound:fresh-compound");

    await migrateRegistryNamespace(db);

    const after = await getRegistryRecord("vialgrade:compound:fresh-compound");
    expect(after!.registryId).toBe("vialgrade:compound:fresh-compound");
    expect(after!.aliases).not.toContain("vial:compound:fresh-compound");
  });
});

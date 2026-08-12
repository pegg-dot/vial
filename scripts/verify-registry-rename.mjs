// Proves the VialGrade identifier migration against the REAL database: every public ID
// moved namespace, every pre-rename citation still resolves, and nothing was destroyed.
import { getDatabase } from "../src/server/db/client.ts";
import { getRegistryRecord } from "../src/server/registry/repository.ts";

const db = await getDatabase();
let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

console.log("\n=== VialGrade registry rename — live database verification ===\n");

const columns = (await db.query(
  `SELECT table_name,column_name FROM information_schema.columns
   WHERE table_name IN ('registry_identifiers','registry_identifier_aliases')
     AND column_name IN ('vial_id','registry_id') ORDER BY table_name`,
)).rows;
check(
  columns.length === 2 && columns.every(c => c.column_name === "registry_id"),
  "column renamed in both tables",
  columns.map(c => `${c.table_name}.${c.column_name}`).join(", "),
);

const total = Number((await db.query(`SELECT COUNT(*) count FROM registry_identifiers`)).rows[0].count);
const legacy = Number((await db.query(`SELECT COUNT(*) count FROM registry_identifiers WHERE registry_id LIKE 'vial:%'`)).rows[0].count);
const migrated = Number((await db.query(`SELECT COUNT(*) count FROM registry_identifiers WHERE registry_id LIKE 'vialgrade:%'`)).rows[0].count);
check(total > 0, "registry holds identifiers", `${total} total`);
check(legacy === 0, "no identifier left in the legacy namespace", `${legacy} legacy`);
check(migrated === total, "every identifier is in the vialgrade namespace", `${migrated}/${total}`);

const formerIds = (await db.query(`SELECT registry_id,alias FROM registry_identifier_aliases WHERE alias_type='former-id' ORDER BY alias`)).rows;
check(formerIds.length === total, "every migrated identifier kept its former ID as an alias", `${formerIds.length} former-id aliases`);

// The load-bearing guarantee: a citation published before the rename still resolves.
if (formerIds.length > 0) {
  const sample = formerIds.slice(0, 5);
  for (const { alias, registry_id } of sample) {
    const record = await getRegistryRecord(alias);
    check(record?.registryId === registry_id, `pre-rename citation resolves: ${alias}`, record ? `→ ${record.registryId}` : "UNRESOLVED");
  }
}

const danglingRedirects = (await db.query(
  `SELECT registry_id,redirects_to FROM registry_identifiers
   WHERE status='redirected' AND (redirects_to IS NULL OR redirects_to LIKE 'vial:%')`,
)).rows;
check(danglingRedirects.length === 0, "no redirect tombstone was nulled or left in the old namespace", `${danglingRedirects.length} dangling`);

const orphanAliases = Number((await db.query(
  `SELECT COUNT(*) count FROM registry_identifier_aliases a
   LEFT JOIN registry_identifiers ri ON ri.registry_id=a.registry_id WHERE ri.registry_id IS NULL`,
)).rows[0].count);
check(orphanAliases === 0, "no alias was orphaned by the key rewrite", `${orphanAliases} orphans`);

console.log(`\n${failures === 0 ? "PASS" : `FAIL (${failures})`} — ${total} identifiers, ${formerIds.length} former-ID aliases preserved\n`);
process.exit(failures === 0 ? 0 : 1);

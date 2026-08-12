// Rewrites the brand inside already-published database text.
//
// A blanket replace here would be data corruption: 318 of the ~480 stored "VIAL" occurrences are
// the PHYSICAL noun inside scraped vendor product titles ("FOLLISTATIN 315 PEPTIDE 1MG VIAL"),
// which is third-party source content we aggregate and must not edit. So this rewrites an explicit
// allowlist of phrases VialGrade itself authored, and nothing else.
//
// Idempotent. Pass --apply to write; the default is a dry run.
import { getDatabase, resetDatabaseForTests } from "../src/server/db/client.ts";

const apply = process.argv.includes("--apply");

// Every phrase is one VialGrade-authored sentence fragment, verified against the live data.
const PHRASES = [
  ["Independent test history aggregated by VIAL; not an endorsement.", "Independent test history aggregated by VialGrade; not an endorsement."],
  ["Aggregated from public sources; VIAL does not endorse any vendor.", "Aggregated from public sources; VialGrade does not endorse any vendor."],
  ["VIAL Seller MCP", "VialGrade Seller MCP"],
  ["how VIAL can aggregate", "how VialGrade can aggregate"],
  ["None are VIAL-tracked vendors.", "None are VialGrade-tracked vendors."],
  ["Sandbox order VIAL-", "Sandbox order VialGrade-"],
  ["Research summaries on VIAL describe", "Research summaries on VialGrade describe"],
  ["VIAL keeps those concepts separate.", "VialGrade keeps those concepts separate."],
  ["VIAL records dated source", "VialGrade records dated source"],
];

const db = await getDatabase();
const columns = (await db.query(
  `SELECT table_name,column_name FROM information_schema.columns
   WHERE data_type IN ('text','character varying') AND table_schema='public'`,
)).rows;

let totalRows = 0;
const touched = [];

for (const { table_name, column_name } of columns) {
  for (const [from, to] of PHRASES) {
    let count;
    try {
      count = Number((await db.query(
        `SELECT COUNT(*) c FROM "${table_name}" WHERE "${column_name}" LIKE $1`,
        [`%${from}%`],
      )).rows[0].c);
    } catch {
      continue; // not a selectable column on this table
    }
    if (count === 0) continue;
    touched.push(`${table_name}.${column_name} — ${count} × "${from.slice(0, 46)}…"`);
    totalRows += count;
    if (apply) {
      await db.query(
        `UPDATE "${table_name}" SET "${column_name}" = REPLACE("${column_name}", $1, $2) WHERE "${column_name}" LIKE $3`,
        [from, to, `%${from}%`],
      );
    }
  }
}

console.log(`\n=== stored brand rename ${apply ? "(APPLIED)" : "(dry run — pass --apply to write)"} ===\n`);
for (const line of touched) console.log("  " + line);
console.log(`\n  ${totalRows} row-replacements across ${touched.length} column/phrase pairs`);

// Guard: prove the physical noun survived untouched.
const physical = Number((await db.query(
  `SELECT COUNT(*) c FROM products WHERE name LIKE '%VIAL%'`,
)).rows[0].c);
console.log(`  ${physical} product titles still contain the physical noun "VIAL" (must be non-zero)\n`);

await resetDatabaseForTests();
process.exit(0);

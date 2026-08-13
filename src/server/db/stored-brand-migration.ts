import type { SqlConnection } from "./client";

// Rewrites the brand inside already-published database text.
//
// This is a migration rather than a one-off script because production was provisioned BEFORE the
// rename and holds ~160 rows of VialGrade-authored prose still reading "VIAL". A fresh deploy that
// ingests from scratch never needs it; an existing deployment does, and it must not depend on
// somebody remembering to run a script with production credentials in hand.
//
// A blanket replace here would be data corruption. Most stored "VIAL" occurrences are the PHYSICAL
// noun inside scraped vendor product titles ("FOLLISTATIN 315 PEPTIDE 1MG VIAL") — third-party
// source content we aggregate and must never edit. So this rewrites an explicit allowlist of
// phrases VialGrade itself authored, and nothing else. Idempotent.
const PHRASES: [from: string, to: string][] = [
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

// The exact places VialGrade-authored prose lives. Enumerated rather than discovered:
//
//  - Discovering columns from information_schema meant 1,132 columns x 9 phrases = 10,188
//    leading-wildcard scans inside the boot transaction, on EVERY database including fresh ones.
//  - The per-column `try/catch { continue }` could not do what it claimed. Migrations run inside a
//    single transaction, and Postgres aborts the whole transaction on any failed statement — so a
//    swallowed error would make every later statement fail, including the schema_migrations
//    inserts, rolling back the entire boot and caching a rejected promise in getDatabase().
//
// A new home for brand prose is a code change here, which is the right place for it to be visible.
const TARGETS: [table: string, column: string][] = [
  ["organizations", "description"],
  ["compounds", "research_note"],
  ["seller_integrations", "display_name"],
  ["regulatory_actions", "summary"],
  ["internal_notifications", "body"],
  ["search_documents", "title"],
  ["search_documents", "body"],
];

export async function migrateStoredBrand(db: SqlConnection): Promise<{ replacements: number }> {
  // Only touch tables that actually exist and are real tables — a missing one must not abort the
  // transaction, and there is no safe way to recover from that inside it.
  const present = new Set(
    (await db.query<{ table_name: string; column_name: string }>(
      `SELECT c.table_name, c.column_name
       FROM information_schema.columns c
       JOIN information_schema.tables t
         ON t.table_schema = c.table_schema AND t.table_name = c.table_name
       WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
         AND c.data_type IN ('text','character varying')`,
    )).rows.map(r => `${r.table_name}.${r.column_name}`),
  );

  let replacements = 0;
  for (const [table, column] of TARGETS) {
    if (!present.has(`${table}.${column}`)) continue;
    for (const [from, to] of PHRASES) {
      const matched = Number((await db.query<{ c: string | number }>(
        `SELECT COUNT(*) c FROM "${table}" WHERE "${column}" LIKE $1`,
        [`%${from}%`],
      )).rows[0]!.c);
      if (matched === 0) continue;
      await db.query(
        `UPDATE "${table}" SET "${column}" = REPLACE("${column}", $1, $2) WHERE "${column}" LIKE $3`,
        [from, to, `%${from}%`],
      );
      replacements += matched;
    }
  }
  return { replacements };
}

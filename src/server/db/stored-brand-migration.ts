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

export async function migrateStoredBrand(db: SqlConnection): Promise<{ replacements: number }> {
  const columns = (await db.query<{ table_name: string; column_name: string }>(
    `SELECT table_name,column_name FROM information_schema.columns
     WHERE data_type IN ('text','character varying') AND table_schema='public'`,
  )).rows;

  let replacements = 0;
  for (const { table_name, column_name } of columns) {
    for (const [from, to] of PHRASES) {
      let matched: number;
      try {
        matched = Number((await db.query<{ c: string | number }>(
          `SELECT COUNT(*) c FROM "${table_name}" WHERE "${column_name}" LIKE $1`,
          [`%${from}%`],
        )).rows[0]!.c);
      } catch {
        continue; // view or otherwise unselectable column
      }
      if (matched === 0) continue;
      await db.query(
        `UPDATE "${table_name}" SET "${column_name}" = REPLACE("${column_name}", $1, $2) WHERE "${column_name}" LIKE $3`,
        [from, to, `%${from}%`],
      );
      replacements += matched;
    }
  }
  return { replacements };
}

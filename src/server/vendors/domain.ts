import type { SqlConnection } from "@/server/db/client";

/** The first stored domain for one vendor organization, or null. Validated by vendorSourceUrl before use. */
export async function getVendorDomain(db: SqlConnection, slug: string): Promise<string | null> {
  const { rows } = await db.query<{ domains: unknown }>(
    `SELECT domains FROM organizations WHERE organization_type = 'vendor' AND slug = $1 LIMIT 1`,
    [slug],
  );
  const domains = rows[0]?.domains;
  return Array.isArray(domains) && domains.length > 0 ? String(domains[0]) : null;
}

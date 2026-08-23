// Every tracked vendor with a domain, read from the catalogue.
//
// Collectors kept being pointed at scripts/data/peptide-vendors.json instead. That file is a
// hand-maintained seed of 34 vendors while the catalogue has grown to 90, so the status probe
// covered 37% and nothing said so. Reading the catalogue is the fix, and it stays correct as the
// catalogue grows. Ordered by slug so a run is reproducible and two runs can be diffed.
import type { SqlConnection } from "@/server/db/client";

export interface VendorDomain { slug: string; name: string; domain: string }

export async function vendorDomains(db: SqlConnection): Promise<VendorDomain[]> {
  const { rows } = await db.query<{ slug: string; display_name: string; domains: unknown }>(
    `SELECT slug, display_name, domains
       FROM organizations
      WHERE organization_type = 'vendor'
        AND jsonb_array_length(domains) > 0
      ORDER BY slug`,
  );
  return rows
    .map((r) => ({ slug: r.slug, name: r.display_name, domain: Array.isArray(r.domains) ? String(r.domains[0]) : "" }))
    .filter((v) => v.domain);
}

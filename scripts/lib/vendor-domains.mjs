// Every tracked vendor with a domain, read from the database.
//
// Collectors kept being pointed at `scripts/data/peptide-vendors.json` instead. That file is a
// hand-maintained seed of 34 vendors; the catalogue has grown to 90. So the status probe covered
// 37% of vendors and nothing said so — the other 56 simply had no Site status, which reads on the
// page as "we haven't looked" rather than "we can't look". The same shape of bug left the whole
// operational-signals seam empty. Reading the catalogue is the fix, and it stays correct as the
// catalogue grows.
//
// Ordered by slug so a run is reproducible and two runs can be diffed.
export async function vendorDomains(db) {
  const { rows } = await db.query(
    `SELECT slug, display_name, domains
       FROM organizations
      WHERE organization_type = 'vendor'
        AND jsonb_array_length(domains) > 0
      ORDER BY slug`,
  );
  return rows
    .map((r) => ({
      slug: r.slug,
      name: r.display_name,
      domain: Array.isArray(r.domains) ? r.domains[0] : null,
    }))
    .filter((v) => v.domain);
}

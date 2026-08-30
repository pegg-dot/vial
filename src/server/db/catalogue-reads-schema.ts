// Migration 56 — when each catalogue product page was last evaluated by its vendor's collector.
//
// A bounded read (per-variation fetch budget, deadline) has to choose which sized products to
// look at, and "what was cut last time goes first" needs a record of what was looked at. Deriving
// that from the listings a product produced was wrong in a way that starves coverage: a product
// that IS evaluated but yields no listing — the pricier of two products for one compound and
// size, the one a cheaper representative outranks — has no listing to date it by, reads as
// never seen, and goes first on every read, spending the budget the genuinely stale products
// needed. One row per product page, touched by one statement at the end of each read.
export const catalogueReadsSchemaSql = String.raw`
CREATE TABLE IF NOT EXISTS catalogue_product_reads (
  product_url TEXT PRIMARY KEY,
  vendor_slug TEXT NOT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_catalogue_reads_vendor ON catalogue_product_reads (vendor_slug, evaluated_at);
`;

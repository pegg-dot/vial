// The grade, materialized onto the vendor row.
//
// It was computed live on the vendor page only — ~10 queries per vendor — which made it far too
// expensive to show on /market or a product card. So the single most important signal in the
// product was invisible on exactly the pages a buyer lands on first.
//
// Materializing it makes it free everywhere AND makes it one number: market, product page and
// vendor page all read this row rather than each deriving their own. `graded_at` keeps the
// staleness visible instead of implicit.
export const vendorGradeSchemaSql = String.raw`
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS grade_letter TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS grade_band TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS grade_headline TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS grade_rationale TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS grade_summary TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS grade_weighed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS grade_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_organizations_grade ON organizations(grade_band, grade_letter);
`;

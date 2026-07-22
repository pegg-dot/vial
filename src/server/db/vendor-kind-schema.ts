// Whether an organization is a retail storefront (shoppable) or an upstream manufacturer (surfaced
// only from lab records). Defaults to 'storefront'; the reconcile pass sets it from the evidence.
export const vendorKindSchemaSql = String.raw`
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS vendor_kind TEXT NOT NULL DEFAULT 'storefront';
CREATE INDEX IF NOT EXISTS idx_org_vendor_kind ON organizations(vendor_kind) WHERE organization_type='vendor';
`;

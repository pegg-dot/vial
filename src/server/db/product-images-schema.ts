// Real vendor product photo for a LIVE listing, extracted from the vendor's own product
// page (og:image). Demo listings keep the generated vial illustration. No semicolons in
// comments — the migration runner splits statements on the semicolon.
export const productImagesSchemaSql = `
ALTER TABLE listings ADD COLUMN IF NOT EXISTS image_url TEXT;
`;

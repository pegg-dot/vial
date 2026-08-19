// Retire listings filed under the wrong molecule by a short-alias collision.
//
// `matchCompound` in server/ingest/shopify-import.ts carries a COLLIDES map because two aliases in
// `compounds.aliases` are short enough to match a different substance entirely:
//
//   "Ipam"  — ipamorelin is a growth-hormone secretagogue peptide.
//             INDOLEPROPIONAMIDE, also abbreviated IPAM, is a tryptophan metabolite.
//   "GnRH"  — gonadorelin is GnRH itself. "GnRH (Triptorelin)" is a different drug.
//
// The guard works: verified against the real product titles, all three INDOLEPROPIONAMIDE shapes
// now return null while "Ipamorelin 5mg" still matches. But the guard only runs at INGEST, and
// nothing ever re-checks rows already stored. Seven listings predating it stayed mis-filed:
//
//   5 INDOLEPROPIONAMIDE listings under ipamorelin  (umbrella-labs ×4, modern-aminos ×1)
//   2 "GnRH (Triptorelin)" listings under gonadorelin (peptide-pros ×2)
//
// A visitor comparing ipamorelin saw five products that are not ipamorelin, priced per mg against
// it, dragging the median. Selling the wrong molecule as the right one is the most dangerous error
// this product can make, which is exactly why the COLLIDES guard exists — the data simply never
// caught up with it.
//
// RETIRED, NOT DELETED. `products.compound_id` is NOT NULL, so a mis-filed row cannot be detached,
// and Indolepropionamide is not a tracked compound — inventing one to hold them would assert
// coverage that does not exist. Setting status off 'active' removes them from every catalog query
// (which all filter status='active') while keeping the row, so the evidence of what was scraped
// survives and the decision is reversible.
//
// Matching on the product NAME, not on the listing slug, so this stays correct if slugs change and
// catches any future row that arrives the same way.
export const collidedListingRepairSql = String.raw`
UPDATE products SET status = 'retired-wrong-compound'
 WHERE status = 'active'
   AND id IN (
     SELECT p.id FROM products p
       JOIN compounds c ON c.id = p.compound_id
      WHERE (c.slug = 'ipamorelin'   AND UPPER(p.name) LIKE '%INDOLEPROPIONAMIDE%')
         OR (c.slug = 'gonadorelin'  AND UPPER(p.name) LIKE '%TRIPTORELIN%')
   );
`;

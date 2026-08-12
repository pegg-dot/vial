// Canonical qualifiers for VialGrade's derived claims. A displayed number is only as honest as what it
// admits about its own origin. A purity % is READ from the lab's certificate as issued — VialGrade does
// not re-run the assay, sample the vial, or observe custody. Copying the batch-passport discipline so
// a document-read never wears the clothes of a VialGrade measurement. One string, used everywhere a purity
// figure appears, so the qualifier can never drift between surfaces.

export const PURITY_PROVENANCE =
  "Purity is read from the lab's certificate as issued — VialGrade doesn't re-run the assay or sample the vial. It reflects one lab's result for one submitted batch, not every vial.";

// Compact form for tight spots (stat captions, cards) where the full sentence won't fit.
export const PURITY_PROVENANCE_SHORT = "Read from the certificate, not re-measured by VialGrade.";

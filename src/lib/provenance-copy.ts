// Canonical qualifiers for VialGrade's derived claims. A displayed number is only as honest as what it
// admits about its own origin. A purity % is READ from the lab's certificate as issued — VialGrade does
// not re-run the assay, sample the vial, or observe custody. Copying the batch-passport discipline so
// a document-read never wears the clothes of a VialGrade measurement. One string, used everywhere a purity
// figure appears, so the qualifier can never drift between surfaces.

export const PURITY_PROVENANCE =
  "Purity is read from the lab's certificate as issued — VialGrade doesn't re-run the assay or sample the vial. " +
  "It reflects one lab's result for one submitted batch, not every vial — and it says nothing about how the peptide was MADE. " +
  "A reported purity number does not verify manufacturing conditions or authorize use of the term \"pharmaceutical grade\". GMP-related claims require separate documented substantiation.";

// Compact form for tight spots (stat captions, cards) where the full sentence won't fit.
export const PURITY_PROVENANCE_SHORT = "Read from the certificate, not re-measured by VialGrade. Purity is not a grade.";

// The distinction vendors blur hardest, in one place so it cannot drift between surfaces.
//
// A buyer reads "99.4% pure, independently tested" as "pharmaceutical quality". Those are different
// claims: purity is WHAT IS IN THE VIAL, grade is HOW IT WAS MADE. Almost everything in this market
// is research-use-only material — which is a disclaimer about intended use, not a quality tier —
// and "pharmaceutical grade" means nothing without a GMP certificate to point at.
export const PURITY_IS_NOT_GRADE =
  "Purity and grade are different questions. A reported test describes the submitted sample; it cannot establish what a future vial contains or whether it " +
  "was filled in a controlled facility. A research-use label does not determine the legal status of human-use marketing.";

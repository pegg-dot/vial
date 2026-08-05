import type { EvidenceLevel, ListingTrustStatus, Product } from "./types";

// The evidence badge shows a listing's PROVENANCE level. Live ingestion freezes `evidence_level`/
// `evidence_label` at "Awaiting first check" → "Vendor catalog" and never recomputes them, so a
// vendor with a matched independent test still badged "Vendor catalog" — contradicting the trust chip
// and COA panel beside it. For a live listing we instead derive the badge from the SAME live verdict
// (`product.trust`, computed from lab_test_records), so every surface reads one truth. Demo listings
// keep their curated column. Provenance labels here are intentionally distinct from the verdict chip.
const BADGE: Record<ListingTrustStatus, { level: EvidenceLevel; label: string }> = {
  "batch-verified": { level: "independent", label: "Independent test" },
  verified: { level: "independent", label: "Independent test" },
  "low-purity": { level: "independent", label: "Independent test" },
  unbacked: { level: "vendor-published", label: "Testing unverified" },
  "no-claim": { level: "public-only", label: "Vendor catalog" },
  mismatch: { level: "stale", label: "Cert flagged" },
};

export function evidenceBadgeFor(product: Pick<Product, "origin" | "evidenceLevel" | "evidenceLabel" | "trust">): { level: EvidenceLevel; label: string } {
  if (product.origin === "live" && product.trust) return BADGE[product.trust.status];
  return { level: product.evidenceLevel, label: product.evidenceLabel };
}

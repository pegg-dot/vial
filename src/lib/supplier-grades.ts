import type { VendorDirectoryEntry } from "./vendor-ranking";

/**
 * The supplier lens (organizations graded on documented evidence) is built but OFF unless the
 * deployment sets VIALGRADE_SUPPLIER_GRADES=true. It is separate from the evidence-only quarantine
 * on purpose: turning it on never reopens the old /vendors, /labs or /go routes, prices or referrals.
 */
export function supplierGradesReleased(enabled = process.env.VIALGRADE_SUPPLIER_GRADES): boolean {
  return enabled === "true";
}

/** Below this many independent certificates a grade is shown as tentative, not as a settled letter. */
export const TENTATIVE_BELOW_CERTIFICATES = 3;

export type SupplierConfidence = "unrated" | "tentative" | "established";

export function supplierConfidence(certificates: number, letter: string | null): SupplierConfidence {
  if (!letter || certificates <= 0) return "unrated";
  return certificates < TENTATIVE_BELOW_CERTIFICATES ? "tentative" : "established";
}

export interface SupplierRow {
  slug: string;
  name: string;
  kind: "storefront" | "manufacturer";
  letter: string | null;
  confidence: SupplierConfidence;
  headline: string;
  certificates: number;
  medianPurity: number | null;
  passports: number;
  latestTestedAt: string | null;
  gradedAt: string | null;
  /** Worst public enforcement severity on record, or null. A fact with a source, never our accusation. */
  enforcement: "severe" | "caution" | null;
  integrityFlagged: boolean;
}

/**
 * The only fields the supplier lens may show. Price, catalog, buyer reviews, sentiment, the
 * composed "avoid" verdict and outbound seller links are deliberately not copied across.
 */
export function supplierRows(entries: readonly VendorDirectoryEntry[]): SupplierRow[] {
  return entries
    .map(({ vendor, enforcement, integrityFlagged }) => ({
      slug: vendor.slug,
      name: vendor.name,
      kind: vendor.kind,
      letter: vendor.grade?.letter ?? null,
      confidence: supplierConfidence(vendor.coaCount, vendor.grade?.letter ?? null),
      headline: vendor.grade?.headline ?? "Not graded yet",
      certificates: vendor.coaCount,
      medianPurity: vendor.medianPurity,
      passports: vendor.passportCount,
      latestTestedAt: vendor.latestTestedAt,
      gradedAt: vendor.grade?.gradedAt ?? null,
      enforcement,
      integrityFlagged,
    }))
    .sort((a, b) => b.certificates - a.certificates || a.name.localeCompare(b.name));
}

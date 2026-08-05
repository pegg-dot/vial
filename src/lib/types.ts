export type EvidenceLevel =
  | "independent"
  | "issuer-confirmed"
  | "vendor-published"
  | "public-only"
  | "stale";

export type CheckoutMode =
  | "information-only"
  | "outbound"
  | "marketplace-pending";

export type VendorStatus = "participating" | "claimed" | "unclaimed";

// Provenance of a record: seeded demo/fictional data vs data aggregated from a
// real public third-party source. Never implies endorsement or human-use safety.
export type DataOrigin = "demo" | "live";

export interface Compound {
  slug: string;
  name: string;
  shorthand: string;
  category: string;
  description: string;
  aliases: string[];
  listings: number;
  medianPrice: number;
  medianPricePerMg: number | null;   // median $/mg across listings whose size we can read; null when too few
  priceChange: number;
  documentationCoverage: number;
  coaCount: number;         // independent lab certificates on record for this compound (self-published excluded)
  medianPurity: number | null;
  accent: [string, string, string];
  researchNote: string;
  origin: DataOrigin;
}

export interface Vendor {
  slug: string;
  name: string;
  initials: string;
  description: string;
  location: string;
  founded: string;
  profileStatus: VendorStatus;
  productCount: number;
  documentationCurrent: number;
  medianShipDays: number;
  supportScore: number;
  lastObserved: string;
  accent: [string, string];
  history: Array<{
    date: string;
    event: string;
    type: "catalog" | "document" | "profile" | "policy";
  }>;
  origin: DataOrigin;
  kind: "storefront" | "manufacturer";
  // Real, computed-from-source evidence (not the stale denormalized columns).
  coaCount: number;         // independent third-party certificates on record
  medianPurity: number | null;
  passportCount: number;    // published batch passports
  reviewCount: number;      // gathered buyer-reputation records
  latestTestedAt: string | null;
}

export interface EvidenceDimension {
  label: string;
  status: "established" | "partial" | "unknown" | "not-tested";
  detail: string;
}

export type ListingTrustStatus = "batch-verified" | "verified" | "low-purity" | "unbacked" | "mismatch" | "no-claim";

// The compact cross-verification verdict that rides on every product wherever it appears.
export interface ListingTrust {
  status: ListingTrustStatus;
  tone: "good" | "warn" | "bad" | "neutral";
  label: string;
  detail: string;
  priceFlag: "too-cheap" | "price-drop" | null;
  priceNote: string | null;
  // Compound-level independent evidence (market-wide, NOT specific to this vendor) — lets a
  // listing honestly show "this compound is independently characterized" when the vendor itself
  // isn't verified. Count of COAs on record for the compound + their median measured purity.
  compoundCoas: number;
  compoundMedianPurity: number | null;
  // The vendor carries a derived integrity red flag (reused/self-issued/mismatched COA, etc.).
  vendorFlagged?: boolean;
  // Real cost per ACTIVE milligram: raw $/mg divided by measured purity. The honest
  // apples-to-apples value number — a 90%-pure vial costs more per real mg than the sticker says.
  adjustedPricePerMg: number | null;
  purityBasis: "vendor" | "compound" | null;   // whose purity we adjusted by
}

export interface Product {
  slug: string;
  name: string;
  compoundSlug: string;
  vendorSlug: string;
  quantity: string;
  mg?: number;
  pricePerMg?: number;
  form: string;
  price: number;
  previousPrice?: number;
  currency: "USD";
  availability: "In stock" | "Low stock" | "Unavailable";
  shipping: string;
  evidenceLevel: EvidenceLevel;
  evidenceLabel: string;
  reportDate: string;
  reportIssuer: string;
  reportConfirmed: boolean;
  batchCode: string;
  batchLinked: boolean;
  sampleOrigin: string;
  lastChecked: string;
  rating: number;
  reviewCount: number;
  featured?: boolean;
  checkoutMode: CheckoutMode;
  priceHistory: number[];
  accent: [string, string, string];
  evidence: EvidenceDimension[];
  origin: DataOrigin;
  externalUrl?: string;
  imageUrl?: string;        // real vendor product photo (Live listings only); else undefined → generated visual
  trust?: ListingTrust;
}

export interface CatalogSnapshot {
  compounds: Compound[];
  vendors: Vendor[];
  products: Product[];
  generatedAt: string;
}

export interface AgentRun {
  id: string;
  workflow: string;
  target: string;
  status: "published" | "review" | "blocked" | "running";
  startedAt: string;
  duration: string;
  tools: string[];
  proposedChanges: number;
  publishedChanges: number;
  reason?: string;
}

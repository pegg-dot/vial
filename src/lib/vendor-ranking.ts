import type { Vendor } from "./types";
import type { Verdict } from "@/server/verify";

export type ReviewSentiment = "positive" | "mixed" | "negative" | "scam" | "unknown";

// One directory row per vendor: the Vendor record plus ranking signals (gathered server-side in
// a few batch queries). Signals stay decomposable — ranking sorts on them, never blends them
// into a single stored score. Defined here (client-safe) so both the server assembler and the
// client directory can share the type.
export interface VendorDirectoryEntry {
  vendor: Vendor;
  priceIndex: number | null;   // median % of the vendor's $/mg vs each compound's market median (neg = cheaper)
  pricedListings: number;
  enforcement: "severe" | "caution" | null;
  defunct: boolean;
  integrityFlagged: boolean;
  reviewSentiment: ReviewSentiment | null;
  verdict: Verdict;            // the SAME composed verdict the vendor page + /verify show
  redFlag: boolean;            // === (verdict === "avoid") — demoted under every rank, never hidden
}

export interface Priority { key: string; label: string; question: string; blurb: string }

// The priorities a buyer picks between. Fact-based, never use-case based. "reliable" is the
// default so a newcomer who can't yet judge a COA is steered to safe vendors first.
export const PRIORITIES: Priority[] = [
  { key: "reliable", label: "Evidence coverage", question: "What evidence does the registry contain?", blurb: "A composite order of lab reports, public records and reported sentiment. Not a seller-reliability or product-safety certification." },
  { key: "price", label: "Observed price", question: "What prices were documented?", blurb: "Historical source prices and reported quantities, not current offers or proof of product identity." },
  { key: "purity", label: "Reported sample purity", question: "What sample results are available?", blurb: "Ranked by laboratory-reported sample measurements, not the quality of untested inventory." },
  { key: "tested", label: "Report coverage", question: "Where are more reports on record?", blurb: "Certificate counts alone cannot prove product authenticity, safety, lawful sale or shipment quality." },
  { key: "reputation", label: "Reported sentiment", question: "What do public reviews say?", blurb: "Unverified discussion can be incomplete or mistaken; a report is not a finding of fraud or reliability." },
];

const SENTIMENT_RANK: Record<ReviewSentiment, number> = { positive: 3, mixed: 2, unknown: 1, negative: 0, scam: -1 };

// Internal reliability sort key (never displayed as a number — VialGrade shows the signals, not a
// score). Rewards independent tests, purity, positive off-site reputation, and market breadth.
function reliabilityScore(e: VendorDirectoryEntry): number {
  let s = 0;
  if (e.vendor.coaCount > 0) s += 40 + Math.min(e.vendor.coaCount, 20);
  if (e.vendor.medianPurity != null) s += Math.max(0, e.vendor.medianPurity - 90) * 2;
  if (e.vendor.passportCount > 0) s += 8;
  if (e.reviewSentiment) s += SENTIMENT_RANK[e.reviewSentiment] * 4;
  s += Math.min(e.vendor.reviewCount, 10);
  if (e.enforcement === "caution") s -= 25;
  return s;
}

function bySignal(a: number | null, b: number | null, dir: "asc" | "desc"): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;   // missing signal sinks
  if (b == null) return -1;
  return dir === "asc" ? a - b : b - a;
}

// Sort a copy of the entries for the chosen priority. Red-flag vendors (severe enforcement,
// defunct, scam sentiment, integrity flag) always sink to the bottom under every priority —
// enforcement is a gate, not a demotion — but they stay visible and are marked in the UI.
export function rankVendors(entries: VendorDirectoryEntry[], priorityKey: string): VendorDirectoryEntry[] {
  const cmp = (a: VendorDirectoryEntry, b: VendorDirectoryEntry): number => {
    if (a.redFlag !== b.redFlag) return a.redFlag ? 1 : -1;
    switch (priorityKey) {
      case "price": return bySignal(a.priceIndex, b.priceIndex, "asc") || a.vendor.name.localeCompare(b.vendor.name);
      case "purity": return bySignal(a.vendor.medianPurity, b.vendor.medianPurity, "desc") || a.vendor.name.localeCompare(b.vendor.name);
      case "tested": return b.vendor.coaCount - a.vendor.coaCount || (b.vendor.latestTestedAt ?? "").localeCompare(a.vendor.latestTestedAt ?? "") || a.vendor.name.localeCompare(b.vendor.name);
      case "reputation": {
        const sr = (e: VendorDirectoryEntry) => (e.reviewSentiment ? SENTIMENT_RANK[e.reviewSentiment] : -2);
        return sr(b) - sr(a) || b.vendor.reviewCount - a.vendor.reviewCount || a.vendor.name.localeCompare(b.vendor.name);
      }
      default: return reliabilityScore(b) - reliabilityScore(a) || a.vendor.name.localeCompare(b.vendor.name);
    }
  };
  return [...entries].sort(cmp);
}

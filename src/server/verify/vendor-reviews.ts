// Gathered buyer reviews & reputation — store and read. The gathering (open-web search, weighted
// by the community's own asymmetry: failure reports and independent lab results over cheap praise)
// happens offline; this persists the result and serves it to the vendor page.

import type { SqlConnection } from "@/server/db/client";
import { newId } from "@/server/db/ids";

export type ReviewSentiment = "positive" | "mixed" | "negative" | "scam" | "unknown";
export type ReviewVolume = "none" | "sparse" | "moderate" | "heavy";
export type ReviewConfidence = "low" | "medium" | "high";

// The verdict gates on these two enums (a thin/low-confidence negative must NOT force "avoid"). The
// values arrive as free-text JSON from an offline gatherer with no schema enforcement, so a typo
// ("high"/"low" as a VOLUME, "strong" as confidence) would silently read as not-well-supported and
// disable the gate — the exact failure a verifier caught in seed data. Normalize synonyms to the
// canonical enum at the one place that matters (the verdict), so no source can quietly break it.
export function normalizeReviewVolume(v: string | null | undefined): ReviewVolume | null {
  const s = (v ?? "").toLowerCase().trim();
  if (["heavy", "high", "large", "many", "lots", "extensive"].includes(s)) return "heavy";
  if (["moderate", "medium", "med", "some", "fair"].includes(s)) return "moderate";
  if (["sparse", "low", "few", "light", "thin"].includes(s)) return "sparse";
  if (["none", "zero", "0", ""].includes(s)) return "none";
  return null; // unrecognized → unknown; the caller treats it as not-well-supported (fail toward caution)
}
export function normalizeReviewConfidence(c: string | null | undefined): ReviewConfidence | null {
  const s = (c ?? "").toLowerCase().trim();
  if (["high", "strong"].includes(s)) return "high";
  if (["medium", "med", "moderate"].includes(s)) return "medium";
  if (["low", "weak"].includes(s)) return "low";
  return null;
}

export interface VendorReview {
  vendorSlug: string;
  sentiment: ReviewSentiment;
  summary: string;
  positives: string[];
  redFlags: string[];
  sources: string[];
  reviewVolume: "none" | "sparse" | "moderate" | "heavy";
  confidence: "low" | "medium" | "high";
  gatheredAt?: string | null;
}

export async function recordVendorReview(db: SqlConnection, r: VendorReview): Promise<void> {
  await db.query(
    `INSERT INTO vendor_reviews (id, vendor_slug, sentiment, summary, positives, red_flags, sources, review_volume, confidence, origin, gathered_at)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,'live',NOW())
     ON CONFLICT (vendor_slug) DO UPDATE SET sentiment=EXCLUDED.sentiment, summary=EXCLUDED.summary, positives=EXCLUDED.positives,
       red_flags=EXCLUDED.red_flags, sources=EXCLUDED.sources, review_volume=EXCLUDED.review_volume, confidence=EXCLUDED.confidence, gathered_at=NOW()`,
    [newId("vrev"), r.vendorSlug, r.sentiment, r.summary, JSON.stringify(r.positives ?? []), JSON.stringify(r.redFlags ?? []), JSON.stringify(r.sources ?? []), r.reviewVolume, r.confidence],
  );
}

function arr(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[];
  if (typeof v === "string") { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

export async function getVendorReview(db: SqlConnection, vendorSlug: string): Promise<VendorReview | null> {
  const r = (await db.query<{ vendor_slug: string; sentiment: ReviewSentiment; summary: string; positives: unknown; red_flags: unknown; sources: unknown; review_volume: VendorReview["reviewVolume"]; confidence: VendorReview["confidence"]; gathered_at: string | null }>(
    `SELECT vendor_slug, sentiment, summary, positives, red_flags, sources, review_volume, confidence, gathered_at FROM vendor_reviews WHERE vendor_slug=$1`,
    [vendorSlug],
  )).rows[0];
  if (!r) return null;
  return { vendorSlug: r.vendor_slug, sentiment: r.sentiment, summary: r.summary, positives: arr(r.positives), redFlags: arr(r.red_flags), sources: arr(r.sources), reviewVolume: r.review_volume, confidence: r.confidence, gatheredAt: r.gathered_at };
}

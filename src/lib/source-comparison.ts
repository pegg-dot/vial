// The vendor comparison for ONE compound: every source on record, what it lists and the price as
// read, beside what a lab reported for a sample attributed to that source.
//
// Two populations meet here, and on most compounds they barely overlap: vendors whose listings we
// read (prices, no lab report), and sources a lab report names (a result, no listing on record).
// The compound page shows them in two separate tables, so a reader cannot set one source beside
// another. This module joins them into one row per source and keeps every one of them: a source
// with a price and no report, or a report and no price, is still a row, with the gap shown as a gap.
//
// It compares records. It does not rank quality: a report describes one submitted sample, a price
// is a dated observation, and nothing here says which source to choose.
//
// Pure data module: no database, no environment, unit-testable.

import type { Product } from "./types";
import { isSuspicious } from "./market-picks";
import { checkContent } from "@/server/verify/content-check";

/** Structural subset of LabTestRow, so this module never imports the ingest layer. */
export interface ComparisonTest {
  lab: string;
  verify_url: string;
  sample_name: string;
  manufacturer: string;
  vendor_slug: string | null;
  batch_code: string | null;
  purity_pct: string | number | null;
  measured_content: string | null;
  tested_at: string | null;
  test_type: string;
  is_blind: boolean;
  is_independent: boolean;
}

export interface ComparedSource {
  /** URL-safe identity: the vendor slug, or "_" + a slug of the name a report gives. */
  key: string;
  /** Set only when the source has a vendor record to link to. */
  vendorSlug: string | null;
  name: string;
  /** Rankable listings first (price per mg ascending), then the ones with no readable strength. */
  listings: Product[];
  /** Independent reports first, then most recent. */
  tests: ComparisonTest[];

  /** Lowest price per mg as read, skipping listings flagged as price outliers when any other exists. */
  lowestPerMg: number | null;
  lowestPerMgListing: Product | null;
  /** Listings carrying the price-outlier flag. */
  outlierListings: number;
  /** Distinct total sizes listed, in mg, ascending. */
  sizesMg: number[];
  /** Most recent day a listing was read, YYYY-MM-DD. */
  lastRead: string | null;

  independentReports: number;
  blindReports: number;
  /** Reports that do not count as independent (vendor self-published, or an unconfirmed lab). */
  otherReports: number;
  /** Purity figures from independent reports only. */
  purityCount: number;
  purityMin: number | null;
  purityMax: number | null;
  purityMedian: number | null;
  /** Independent reports where measured content could be set against the label. */
  contentChecked: number;
  /** Of those, how many measured under 90% of the label. */
  contentShort: number;
  /** Most recent report date we could read, YYYY-MM-DD. */
  lastReported: string | null;
}

export interface SourceComparison {
  sources: ComparedSource[];
  /** Reports for this compound that name no source, so they belong to no row. */
  unattributedReports: number;
}

const UNNAMED = /^(?:unknown|unspecified|n\/?a|none|not (?:stated|named|provided|given)|[-–—?.\s]*)$/i;

/** The row a report belongs to when it names a source we hold no vendor record for. */
export function reportedSource(manufacturer: string | null | undefined): { key: string; name: string } | null {
  const cleaned = String(manufacturer ?? "").trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "").trim();
  if (UNNAMED.test(cleaned)) return null;
  const slug = cleaned.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) return null;
  // A bare domain reads the same in any case; a trade name keeps the case the report printed.
  const domain = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(cleaned);
  return { key: "_" + slug.slice(0, 64), name: (domain ? cleaned.toLowerCase() : cleaned).slice(0, 64) };
}

/** A report's printed date as YYYY-MM-DD, or null when it cannot be read as a date. */
export function reportDay(raw: string | Date | null | undefined): string | null {
  if (raw == null) return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw.toISOString().slice(0, 10);
  const text = String(raw).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  // Printed dates carry no zone; read the calendar day as written rather than shifting it to UTC.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

const titleCase = (slug: string) => slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const rankable = (p: Product) => p.pricePerMg != null && p.pricePerMg > 0;
const latest = (days: (string | null)[]) => days.filter((d): d is string => Boolean(d)).sort().at(-1) ?? null;

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function summarize(key: string, vendorSlug: string | null, name: string, listings: Product[], tests: ComparisonTest[]): ComparedSource {
  const ranked = listings.filter(rankable).sort((a, b) => a.pricePerMg! - b.pricePerMg! || a.price - b.price);
  const orderedListings = [...ranked, ...listings.filter((p) => !rankable(p))];
  // An outlier price is a warning about the record, not the source's price: skip it unless it is all there is.
  const lowestListing = ranked.find((p) => !isSuspicious(p)) ?? ranked[0] ?? null;

  const independent = tests.filter((t) => t.is_independent !== false);
  const purities = independent.map((t) => (t.purity_pct == null ? NaN : Number(t.purity_pct))).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  const contents = independent.map((t) => checkContent(t.sample_name, t.measured_content).verdict).filter(Boolean);
  const orderedTests = [...tests].sort((a, b) =>
    Number(b.is_independent !== false) - Number(a.is_independent !== false)
    || (reportDay(b.tested_at) ?? "").localeCompare(reportDay(a.tested_at) ?? "")
    || a.verify_url.localeCompare(b.verify_url));

  return {
    key, vendorSlug, name,
    listings: orderedListings,
    tests: orderedTests,
    lowestPerMg: lowestListing?.pricePerMg ?? null,
    lowestPerMgListing: lowestListing,
    outlierListings: listings.filter(isSuspicious).length,
    sizesMg: [...new Set(listings.map((p) => p.mg).filter((mg): mg is number => mg != null && mg > 0))].sort((a, b) => a - b),
    lastRead: latest(listings.map((p) => (p.observedAt ? p.observedAt.slice(0, 10) : null))),
    independentReports: independent.length,
    blindReports: independent.filter((t) => t.is_blind).length,
    otherReports: tests.length - independent.length,
    purityCount: purities.length,
    purityMin: purities[0] ?? null,
    purityMax: purities.at(-1) ?? null,
    purityMedian: median(purities),
    contentChecked: contents.length,
    contentShort: contents.filter((v) => v === "underdosed").length,
    lastReported: latest(independent.map((t) => reportDay(t.tested_at))),
  };
}

/**
 * One row per source for a compound. `vendorNames` is every vendor that has a public record
 * (slug to display name): a report attributed to a vendor outside it is filed under the name the
 * report prints, with no link, rather than pointing at a page that does not exist.
 *
 * The invariant: every listing lands in exactly one row, and every report either lands in exactly
 * one row or is counted in `unattributedReports`.
 */
export function buildSourceComparison(listings: readonly Product[], tests: readonly ComparisonTest[], vendorNames: ReadonlyMap<string, string>): SourceComparison {
  const rows = new Map<string, { vendorSlug: string | null; name: string; listings: Product[]; tests: ComparisonTest[] }>();
  const row = (key: string, vendorSlug: string | null, name: string) => {
    let entry = rows.get(key);
    if (!entry) { entry = { vendorSlug, name, listings: [], tests: [] }; rows.set(key, entry); }
    return entry;
  };

  for (const p of listings) row(p.vendorSlug, p.vendorSlug, vendorNames.get(p.vendorSlug) ?? titleCase(p.vendorSlug)).listings.push(p);

  let unattributedReports = 0;
  for (const t of tests) {
    const slug = t.vendor_slug;
    if (slug && (rows.get(slug)?.vendorSlug === slug || vendorNames.has(slug))) {
      row(slug, slug, vendorNames.get(slug) ?? titleCase(slug)).tests.push(t);
      continue;
    }
    const named = reportedSource(t.manufacturer);
    if (!named) { unattributedReports += 1; continue; }
    row(named.key, null, named.name).tests.push(t);
  }

  const sources = [...rows.entries()].map(([key, r]) => summarize(key, r.vendorSlug, r.name, r.listings, r.tests));
  return { sources: sortSources(sources, "coverage"), unattributedReports };
}

export type ComparisonSort = "coverage" | "price" | "purity" | "reports" | "read";

export const COMPARISON_SORTS: ReadonlyArray<{ key: ComparisonSort; label: string; blurb: string }> = [
  { key: "coverage", label: "Most complete record", blurb: "Sources with both a listing and a lab report on record come first, then listed only, then reported only. An order of how much is on record, not of quality." },
  { key: "price", label: "Price per mg, low to high", blurb: "The lowest observed price divided by the listed quantity. A dated observation, not a verified unit cost; sources with no listing on record come last." },
  { key: "purity", label: "Reported purity, high to low", blurb: "The median of the purity figures on independent reports. Each describes one submitted sample, not a later vial; sources with no figure on record come last." },
  { key: "reports", label: "Independent reports, most first", blurb: "How many independent lab reports are on record. A count of documents, which does not establish production quality." },
  { key: "read", label: "Most recently read", blurb: "When a listing was last read, not a statement of current availability; sources with no listing on record come last." },
];

export function comparisonSort(raw: string | string[] | undefined): ComparisonSort {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return COMPARISON_SORTS.find((s) => s.key === value)?.key ?? "coverage";
}

/**
 * Order the rows by one key, keeping every one of them. A source missing the figure being sorted
 * on goes LAST: it is never dropped and never read as zero, because "nothing on record" is not
 * "worst". Ties break on name, so the order is total.
 */
export function sortSources(sources: readonly ComparedSource[], sort: ComparisonSort): ComparedSource[] {
  const missingLast = (a: number | string | null, b: number | string | null, dir: "asc" | "desc") => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    const cmp = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
    return dir === "asc" ? cmp : -cmp;
  };
  const byName = (a: ComparedSource, b: ComparedSource) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key);
  const tier = (s: ComparedSource) => (s.listings.length > 0 && s.independentReports > 0 ? 0 : s.listings.length > 0 ? 1 : 2);
  const copy = [...sources];
  switch (sort) {
    case "price":
      return copy.sort((a, b) => missingLast(a.lowestPerMg, b.lowestPerMg, "asc") || byName(a, b));
    case "purity":
      return copy.sort((a, b) => missingLast(a.purityMedian, b.purityMedian, "desc") || b.purityCount - a.purityCount || byName(a, b));
    case "reports":
      return copy.sort((a, b) => b.independentReports - a.independentReports || b.blindReports - a.blindReports || byName(a, b));
    case "read":
      return copy.sort((a, b) => missingLast(a.lastRead, b.lastRead, "desc") || byName(a, b));
    default:
      return copy.sort((a, b) => tier(a) - tier(b)
        || (tier(a) === 2 ? b.independentReports - a.independentReports : missingLast(a.lowestPerMg, b.lowestPerMg, "asc"))
        || byName(a, b));
  }
}

/** The two rows a reader picked for the side by side, in the order picked; unknown keys are dropped. */
export function pickSources(sources: readonly ComparedSource[], a: string | string[] | undefined, b: string | string[] | undefined): ComparedSource[] {
  const keys = [a, b].map((v) => (Array.isArray(v) ? v[0] : v)).filter((v): v is string => Boolean(v));
  const picked: ComparedSource[] = [];
  for (const key of keys) {
    const found = sources.find((s) => s.key === key);
    if (found && !picked.includes(found)) picked.push(found);
  }
  return picked;
}

/** "99.2%" for one figure, "98.7–99.6%" for a spread. */
export function formatPurityRange(source: Pick<ComparedSource, "purityCount" | "purityMin" | "purityMax">): string | null {
  if (source.purityCount === 0 || source.purityMin == null || source.purityMax == null) return null;
  const lo = source.purityMin.toFixed(1), hi = source.purityMax.toFixed(1);
  return lo === hi ? `${hi}%` : `${lo}–${hi}%`;
}

// Filtering and facet derivation for /passports. Pure, so the same code runs in the server render
// and in the client filter, and so the facet table can be tested without a database.
//
// `batch_passports` carries no tag or topic column and there is no full-text index, so every facet
// here is DERIVED from columns the row actually holds:
//   - open_conflicts   (subquery count of evidence_conflicts still open on this passport)
//   - evidence_links   (active evidence links + linked external COAs)
//   - sampling_level   (S1–S4; how the tested sample reached the lab)
//   - origin           ('demo' | 'live' — see AGENTS.md; never presented as an endorsement)
// Nothing is inferred from prose, so a chip means exactly what the column says.

export interface PassportRow {
  id: string;
  slug: string;
  declared_batch_code: string;
  /** 'demo' | 'live'. Optional because older callers may not select it. */
  origin?: string | null;
  sampling_level?: string | null;
  evidence_confidence?: number | string | null;
  compound_slug?: string | null;
  compound_slug_join?: string | null;
  vendor_name?: string | null;
  vendor_slug?: string | null;
  product_name?: string | null;
  compound_name?: string | null;
  listing_slug?: string | null;
  /** COUNT() comes back as a string from node-postgres and a number from PGlite. */
  evidence_links: number | string;
  open_conflicts: number | string;
}

/** How the sample reached the lab, in words rather than an internal code. */
export const PASSPORT_SAMPLING_WORDS: Record<string, string> = {
  S1: "Vendor picked the sample",
  S2: "Customer's sealed unit",
  S3: "Bought blind, like a customer",
  S4: "Bought blind, tested repeatedly",
};

/** The sampling levels where nobody at the vendor chose which unit got tested. */
const BLIND_SAMPLING = new Set(["S3", "S4"]);

const count = (value: number | string | null | undefined) => Number(value ?? 0) || 0;
const sampling = (row: PassportRow) => String(row.sampling_level ?? "").toUpperCase();

export type PassportOriginId = "live" | "demo";
export type PassportEvidenceId = "disagreement" | "corroborated" | "blind";

export interface PassportFacet<Id extends string> {
  id: Id;
  label: string;
  /** Shown on the chip's title attribute — what a reader is actually selecting. */
  note: string;
  match: (row: PassportRow) => boolean;
}

export const PASSPORT_ORIGIN_FACETS: PassportFacet<PassportOriginId>[] = [
  {
    id: "live",
    label: "Live",
    note: "Aggregated from real public lab certificates. Not an endorsement or a safety claim.",
    match: (row) => String(row.origin ?? "demo") === "live",
  },
  {
    id: "demo",
    label: "Demo",
    note: "Seeded demo record used to illustrate the interface — not a real batch.",
    match: (row) => String(row.origin ?? "demo") !== "live",
  },
];

export const PASSPORT_EVIDENCE_FACETS: PassportFacet<PassportEvidenceId>[] = [
  {
    id: "disagreement",
    label: "Results disagree",
    note: "At least one result on this batch still contradicts another, unresolved",
    match: (row) => count(row.open_conflicts) > 0,
  },
  {
    id: "corroborated",
    label: "Two or more tests",
    note: "More than one lab test on record for this batch, so a single result is not the whole story",
    match: (row) => count(row.evidence_links) >= 2,
  },
  {
    id: "blind",
    label: "Bought blind",
    note: "The tested sample was bought like a customer would, not picked out by the vendor",
    match: (row) => BLIND_SAMPLING.has(sampling(row)),
  },
];

export interface PassportFacetOption<Id extends string> {
  id: Id;
  label: string;
  note: string;
  count: number;
}

/**
 * The chips worth rendering for THIS set of rows.
 *
 * A facet is offered only when it matches at least one row and excludes at least one row. The
 * first half is the obvious one — a chip that matches nothing is a dead control that reads as
 * "no results" when the truth is "never any". The second half matters just as much here, because
 * two of these dimensions are effectively binary: on an all-demo corpus a "Demo" chip is a button
 * whose only effect is to redraw the same page, which teaches a reader that the filters do
 * nothing. Neither case is ever rendered.
 */
export function offeredPassportFacets<Id extends string>(
  facets: PassportFacet<Id>[],
  rows: PassportRow[],
): PassportFacetOption<Id>[] {
  return facets
    .map((facet) => ({ id: facet.id, label: facet.label, note: facet.note, count: rows.filter(facet.match).length }))
    .filter((option) => option.count > 0 && option.count < rows.length);
}

export interface PassportFilters {
  query?: string;
  origins?: PassportOriginId[];
  evidence?: PassportEvidenceId[];
}

export const EMPTY_PASSPORT_FILTERS: Required<PassportFilters> = { query: "", origins: [], evidence: [] };

export function hasActivePassportFilters(filters: PassportFilters) {
  return Boolean(filters.query?.trim()) || Boolean(filters.origins?.length) || Boolean(filters.evidence?.length);
}

// Everything a reader could plausibly know this record by. The vendor SLUG is searchable because
// it is what the URL shows them; the compound slug likewise. `compound_slug` is the column on the
// passport, `compound_slug_join` the one resolved through the compounds table — a row may carry
// either, so both are searched.
function haystack(row: PassportRow) {
  return [
    row.declared_batch_code,
    row.vendor_name,
    row.vendor_slug,
    row.product_name,
    row.compound_name,
    row.compound_slug,
    row.compound_slug_join,
    row.slug,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Case-folded, punctuation-stripped — "HX-BPC-2607", "hx bpc 2607" and "hxbpc2607" all collapse. */
const collapse = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * A batch code is transcribed off a vial label or a COA, so a reader will not reproduce its
 * punctuation reliably. Codes and slugs therefore also match with separators removed. This is
 * deliberately NOT applied to the whole haystack: collapsing the joined fields would run words
 * together across field boundaries and match on fragments that appear in neither field.
 */
function codeMatch(row: PassportRow, collapsedQuery: string) {
  if (!collapsedQuery) return false;
  return collapse(row.declared_batch_code).includes(collapsedQuery) || collapse(row.slug).includes(collapsedQuery);
}

/**
 * Filters intersect: every active dimension must match. Within one dimension the selected chips
 * are an OR (picking two origins widens that dimension), across dimensions an AND. A union across
 * dimensions would mean adding a filter can ADD results, which is the opposite of what a person
 * clicking a chip expects.
 */
export function filterPassports(rows: PassportRow[], filters: PassportFilters): PassportRow[] {
  const query = filters.query?.trim().toLowerCase() ?? "";
  const collapsedQuery = collapse(query);
  const origins = filters.origins ?? [];
  const evidence = filters.evidence ?? [];
  const originFacets = PASSPORT_ORIGIN_FACETS.filter((facet) => origins.includes(facet.id));
  const evidenceFacets = PASSPORT_EVIDENCE_FACETS.filter((facet) => evidence.includes(facet.id));

  return rows.filter((row) => {
    if (originFacets.length && !originFacets.some((facet) => facet.match(row))) return false;
    if (evidenceFacets.length && !evidenceFacets.some((facet) => facet.match(row))) return false;
    if (query && !haystack(row).includes(query) && !codeMatch(row, collapsedQuery)) return false;
    return true;
  });
}

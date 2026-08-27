// Filtering and facet derivation for /vendors. Pure, so the directory can be filtered without a
// database and the facet table can be tested against a real corpus shape.
//
// The directory row is a `VendorDirectoryEntry` — a Vendor record plus decomposed ranking signals.
// Nothing here is inferred from prose: the one facet dimension is `vendor.kind`, a stored column
// with two values, and the keyword search reads only fields the Vendor record actually carries.
//
// Searchable fields, and why each one:
//   - name      — what a buyer knows the company by, and what they arrive having been told.
//   - slug      — what the URL shows them, and what a forum post links.
//   - location  — the one thing on the card a buyer filters on by hand ("anything shipping from the US").
// Deliberately NOT the description: it is marketing prose, and matching it makes a search for one
// vendor return every competitor that name-drops them.

import type { VendorDirectoryEntry } from "./vendor-ranking";

export type VendorKindId = "storefront" | "manufacturer";

export interface VendorKindFacet {
  id: VendorKindId;
  label: string;
  /** Shown on the chip's title attribute — what a reader is actually selecting. */
  note: string;
  match: (entry: VendorDirectoryEntry) => boolean;
}

export const VENDOR_KIND_FACETS: VendorKindFacet[] = [
  {
    id: "storefront",
    label: "Shops you can buy from",
    note: "Sells directly to buyers — the vendors a purchase actually goes through",
    match: (entry) => entry.vendor.kind === "storefront",
  },
  {
    id: "manufacturer",
    label: "Upstream makers",
    note: "Manufactures or supplies the material other sellers resell — you generally cannot buy here",
    match: (entry) => entry.vendor.kind === "manufacturer",
  },
];

export interface VendorKindOption {
  id: VendorKindId;
  label: string;
  note: string;
  count: number;
}

/**
 * The kind chips worth rendering for THIS set of entries.
 *
 * A facet is offered only when it matches at least one entry and excludes at least one entry. A
 * chip matching nothing is a dead control that empties the grid and reads as "we lost your
 * vendors". A chip matching EVERYTHING is just as bad in the other direction: on an all-storefront
 * directory it is a button whose only effect is to redraw the same page, which teaches a reader
 * that the filters do nothing. Neither is ever rendered; "Everyone" is rendered unconditionally by
 * the UI as the way back.
 */
export function offeredVendorKinds(entries: VendorDirectoryEntry[]): VendorKindOption[] {
  return VENDOR_KIND_FACETS
    .map((facet) => ({ id: facet.id, label: facet.label, note: facet.note, count: entries.filter(facet.match).length }))
    .filter((option) => option.count > 0 && option.count < entries.length);
}

export interface VendorDirectoryFilters {
  query?: string;
  /** A VendorKindId, or "all"/undefined for every kind. */
  kind?: string;
}

export function hasActiveVendorFilters(filters: VendorDirectoryFilters) {
  return Boolean(filters.query?.trim()) || Boolean(filters.kind && filters.kind !== "all");
}

function haystack(entry: VendorDirectoryEntry) {
  const vendor = entry.vendor;
  return [vendor.name, vendor.slug, vendor.location].filter(Boolean).join(" ").toLowerCase();
}

/** Case-folded, punctuation-stripped — "Swiss Chems", "swiss-chems" and "swisschems" all collapse. */
const collapse = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * A vendor is named inconsistently everywhere a buyer might meet it: "Swiss Chems" on the site,
 * "swiss-chems" in our URL, "SwissChems" in the forum post that sent them here. Name and slug
 * therefore also match with separators removed. Applied per FIELD rather than to the joined
 * haystack, so collapsing never runs two fields together and matches on a fragment that appears in
 * neither.
 */
function collapsedMatch(entry: VendorDirectoryEntry, collapsedQuery: string) {
  if (!collapsedQuery) return false;
  return collapse(entry.vendor.name).includes(collapsedQuery) || collapse(entry.vendor.slug).includes(collapsedQuery);
}

/**
 * Filters intersect: every active dimension must match. A union would mean adding a filter can ADD
 * results, which is the opposite of what a person typing into a search box expects.
 */
export function filterVendorEntries(entries: VendorDirectoryEntry[], filters: VendorDirectoryFilters): VendorDirectoryEntry[] {
  const query = filters.query?.trim().toLowerCase() ?? "";
  const collapsedQuery = collapse(query);
  const facet = VENDOR_KIND_FACETS.find((item) => item.id === filters.kind);
  return entries.filter((entry) => {
    if (facet && !facet.match(entry)) return false;
    if (query && !haystack(entry).includes(query) && !collapsedMatch(entry, collapsedQuery)) return false;
    return true;
  });
}

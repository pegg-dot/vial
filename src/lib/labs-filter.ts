// Faceting for /labs. Pure, so the server page can filter without a database and the facet table
// can be tested against the real registry.
//
// The page's whole subject is the difference between a lab we have confirmed is a real, independent
// third party and one we have not — so that is the dimension it filters on. `independence` is a
// stored, sourced field on the registry profile (see src/server/labs/registry.ts), never inferred.
//
// The row type here is structural rather than an import of LabProfile: this module is client-safe
// and has no business reaching into src/server for a shape it only needs three fields of.

export type LabIndependenceId = "independent" | "independence-unverified" | "unverified";

export interface LabFilterRow {
  slug: string;
  independence: string;
  /** Certificates from this lab in OUR records. Zero is a fact about our coverage, not the lab. */
  coaCount: number;
}

export interface LabFacet {
  id: LabIndependenceId;
  label: string;
  /** Shown on the chip's title attribute — what a reader is actually selecting. */
  note: string;
  match: (row: LabFilterRow) => boolean;
}

export const LAB_INDEPENDENCE_FACETS: LabFacet[] = [
  {
    id: "independent",
    label: "Confirmed independent",
    note: "We confirmed this is a real third-party laboratory, separate from the vendors whose products it tests. The only tier whose certificates we count as independent corroboration.",
    match: (row) => row.independence === "independent",
  },
  {
    id: "independence-unverified",
    label: "Independence unverified",
    note: "The lab exists, but we could not confirm it is independent of the sellers it tests. Shown for transparency, never counted as corroboration.",
    match: (row) => row.independence === "independence-unverified",
  },
  {
    id: "unverified",
    label: "Unverified lab",
    note: "We could not confirm this laboratory exists as a distinct entity at all. Treat a certificate naming it as unbacked.",
    match: (row) => row.independence === "unverified",
  },
];

export function isLabIndependenceId(value: string | undefined | null): value is LabIndependenceId {
  return LAB_INDEPENDENCE_FACETS.some((facet) => facet.id === value);
}

/**
 * Whether we hold any certificate from this lab.
 *
 * A registered lab with no certificates is worth listing — the page's thesis is independent vs
 * unverified, and a reader holding a COA from a lab we have vetted but never seen data from is
 * exactly who this page is for. What is NOT acceptable is rendering it beside a lab with 400
 * certificates using the same "Certificates / Vendors" tiles, where a 0 reads as a measurement of
 * the lab rather than a statement about our records. So the two states are named and kept apart.
 */
export function labHasEvidence(row: LabFilterRow): boolean {
  return row.coaCount > 0;
}

export interface LabFacetOption {
  id: LabIndependenceId;
  label: string;
  note: string;
  count: number;
}

/**
 * The chips worth rendering for THIS set of labs.
 *
 * A facet is offered only when it matches at least one lab and excludes at least one lab. A chip
 * that matches nothing is a dead control that empties the page; a chip that matches everything is a
 * button whose only effect is to redraw the same page — on an all-independent registry, a
 * "Confirmed independent" chip teaches a reader that the filters do nothing.
 */
export function offeredLabFacets(rows: LabFilterRow[]): LabFacetOption[] {
  return LAB_INDEPENDENCE_FACETS
    .map((facet) => ({ id: facet.id, label: facet.label, note: facet.note, count: rows.filter(facet.match).length }))
    .filter((option) => option.count > 0 && option.count < rows.length);
}

export interface LabFilters {
  independence?: string;
}

export function hasActiveLabFilters(filters: LabFilters) {
  return isLabIndependenceId(filters.independence);
}

/** An unknown or absent independence value means no filter — never an empty page. */
export function filterLabs<Row extends LabFilterRow>(rows: Row[], filters: LabFilters): Row[] {
  const facet = LAB_INDEPENDENCE_FACETS.find((item) => item.id === filters.independence);
  return facet ? rows.filter(facet.match) : rows;
}

/** Split a filtered set into the labs we hold certificates from and the ones we do not. */
export function partitionLabsByEvidence<Row extends LabFilterRow>(rows: Row[]): { tested: Row[]; untested: Row[] } {
  return {
    tested: rows.filter((row) => labHasEvidence(row)),
    untested: rows.filter((row) => !labHasEvidence(row)),
  };
}

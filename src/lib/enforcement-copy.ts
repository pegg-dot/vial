// What /enforcement should say when the list on screen is empty.
//
// The page had two adjacent blocks disagreeing: one said "Nothing on record for this filter."
// (correct) and the other said "No enforcement records ingested yet." (a claim about the whole
// corpus) — and the second fired whenever the FILTER was empty. The default filter is
// vendor-matched, so a site holding 200 unmatched openFDA recalls told every arriving reader that
// nothing had been ingested.
//
// Pure and separate because the page-level branch cannot be exercised by the seeded fixture, which
// holds zero enforcement records: only the corpus-empty arm is reachable there. Given a filter
// count and a corpus count this is four cases, and all four are tested.

export type EnforcementEmptyState =
  | { kind: "results" }
  /** Nothing has ever been ingested. The only case entitled to a claim about the corpus. */
  | { kind: "corpus-empty"; message: string }
  /** Records exist; this filter matched none. Never blame the corpus, and offer the way out. */
  | { kind: "filter-empty"; message: string; offerAllFilter: true };

export function enforcementEmptyState(input: { corpusTotal: number; filteredTotal: number }): EnforcementEmptyState {
  if (input.filteredTotal > 0) return { kind: "results" };
  if (input.corpusTotal <= 0) return { kind: "corpus-empty", message: "No enforcement records ingested yet." };
  return { kind: "filter-empty", message: "Nothing on record for this filter.", offerAllFilter: true };
}

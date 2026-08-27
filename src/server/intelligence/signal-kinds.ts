/**
 * The public signal kinds — ONE list that decides both which signals /signals reads out of the
 * database and what each one is called in a reader's words.
 *
 * This was two lists. The page carried a thirteen-entry label map; the repository's query
 * restricted `signal_type` to seven values. So six of the thirteen labels could never render:
 * batch-document-gap, vendor-onboarding, listing-evidence-refresh, source-health,
 * new-batch-evidence and listing-price-outlier were written to the table, counted as open, and
 * silently withheld from the only page that exists to show them.
 *
 * Which of the two was wrong is not a matter of taste. Every one of those six types IS emitted by
 * running code — the sweep scanner, the publication cascade, and the refresh scheduler all write
 * them (see the scan in tests/unit/public-signal-kinds.test.ts) — and the page's own headline
 * promises exactly those signals: "price swings, thin stock, and listings that lost their lab
 * reports". The QUERY was the narrow one. A reader was being shown a subset of what the system
 * knew, with nothing on the page saying a subset was what they were getting.
 *
 * Source-health signals are public for the same reason source-coverage-gap always was: when our
 * own check on a source stops working, the reader's picture of that vendor is going stale, and
 * hiding that would make the feed quietly less honest than the database.
 *
 * The WHERE clause is DERIVED from this map, so the two cannot drift apart again.
 */
export const PUBLIC_SIGNAL_KINDS: Record<string, string> = {
  "price-dispersion": "Prices are all over the map",
  "thin-availability": "Hard to find right now",
  "compound-evidence-gap": "Lab reports are patchy",
  "vendor-evidence-gap": "Missing lab reports",
  "source-coverage-gap": "Not watched automatically yet",
  "batch-document-gap": "Batch with no lab report",
  "vendor-onboarding": "Nobody has claimed this page",
  "listing-evidence-refresh": "Needs a fresh look",
  "issuer-concentration": "All the tests come from one lab",
  "supply-concentration": "Only a few sellers",
  "source-health": "Our check on this source is failing",
  "new-batch-evidence": "New batch, nothing to back it yet",
  "listing-price-outlier": "Priced far from the rest",
};

/** Every signal type a reader is allowed to see, in the order the map declares them. */
export const PUBLIC_SIGNAL_TYPES = Object.keys(PUBLIC_SIGNAL_KINDS);

// These keys are interpolated into SQL rather than bound as parameters, because the clause is
// shared by two queries whose parameter positions differ. They are compile-time constants, and
// this is what keeps them constants: a key that could carry a quote never reaches a query.
const SAFE_SIGNAL_TYPE = /^[a-z][a-z0-9-]*$/;
for (const type of PUBLIC_SIGNAL_TYPES) {
  if (!SAFE_SIGNAL_TYPE.test(type)) {
    throw new Error(`PUBLIC_SIGNAL_KINDS key ${JSON.stringify(type)} is not a safe SQL literal.`);
  }
}

/**
 * The WHERE clause behind the public list AND its count, built from the label map above.
 *
 * `alias` is the table alias the calling query gave `opportunity_signals`.
 */
export function publicSignalWhereSql(alias = "os"): string {
  return `WHERE ${alias}.status IN ('open','watching')
       AND ${alias}.signal_type IN (${PUBLIC_SIGNAL_TYPES.map((type) => `'${type}'`).join(",")})`;
}

/**
 * The label a reader sees.
 *
 * The stored signal_type is a machine key. Rendered raw it reads "compound evidence gap" — three
 * nouns in a trench coat. An unmapped type falls through as readable words rather than blank, so a
 * signal type added without a label is still legible while the test that catches it goes red.
 */
export function publicSignalLabel(signalType: string): string {
  return PUBLIC_SIGNAL_KINDS[signalType] ?? signalType.replaceAll("-", " ");
}

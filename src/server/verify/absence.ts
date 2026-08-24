// Whose fact is it?
//
// The curated vendor-review notes mix two different kinds of sentence, and the vendor page was
// rendering both under one rose "Red flags reported" heading with a warning triangle. Twelve of
// ninety are not findings about a vendor at all — they record that VialGrade could not find
// something. chameleon-peptides carried "No independent Reddit / MESO-Rx / forum verification
// found" as a red flag on a page that grades it A; bluum-peptides carried "No community
// verification at all" while graded B+.
//
// A gap in our own capture, published as a fault of a named real business, directly beside a grade
// that says the opposite. AGENTS.md: an absence of evidence must never read as evidence against a
// vendor. This is where that rule was being broken in the most visible way on the site.

/**
 * Phrases that describe OUR failure to find something rather than the vendor's conduct.
 *
 * Deliberately narrow. "No third-party testing data or COAs published" is about what the vendor
 * does and stays a finding; "no independent forum verification found" is about what we managed to
 * capture and does not.
 */
const OUR_GAP = [
  /\bno\b[^.]*\b(verification|footprint|presence|coverage|corroboration)\b/i,
  /\b(verification|footprint|presence|coverage|corroboration|capture|data)\b[^.]*\b(is |are )?(thin|thinner|sparse|limited|absent)\b/i,
  /\b(thin|sparse|limited)\b[^.]*\b(capture|footprint|presence|coverage|thread)\b/i,
  /\b(not|never|could ?n[o']?t)\s+(found|located|captured|verified)\b/i,
  /\bno\b[^.]*\b(r\/peptides|meso-?rx|reddit|forum|community)\b[^.]*\b(data|verification|presence|footprint)\b/i,
  /\bno community verification\b/i,
];

/**
 * Phrases that are about the VENDOR, even though they are phrased negatively. These win, because
 * mislabelling a real warning as a gap would hide it — worse than showing a gap in the wrong place.
 */
const THEIR_CONDUCT = [
  /\bpublish(es|ed)?\b/i,
  /\bwarning letter\b|\benforcement\b|\brecall\b|\bseiz/i,
  /\bnever (arriv|ship|deliver)/i,
  /\bswitch|\bsubstitut|\bmislabel|\bcounterfeit|\bdilut/i,
  /\bquestioned\b|\bdisput/i,
];

export function isAbsenceOfEvidence(note: string): boolean {
  const text = (note ?? "").trim();
  if (!text) return false;
  if (THEIR_CONDUCT.some((re) => re.test(text))) return false;
  return OUR_GAP.some((re) => re.test(text));
}

/** Split curated notes into what we found against a vendor, and what we simply could not check. */
export function splitFindingsAndGaps(notes: readonly string[]): { findings: string[]; gaps: string[] } {
  const findings: string[] = [];
  const gaps: string[] = [];
  for (const note of notes) (isAbsenceOfEvidence(note) ? gaps : findings).push(note);
  return { findings, gaps };
}

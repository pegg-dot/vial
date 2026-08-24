// Content / dose verification — the axis a purity number completely misses.
//
// A vial can test 99% pure AND be the right molecule AND still be a rip-off: 7 mg of peptide
// where 10 mg is on the label. Underdosing is the single biggest real-world fraud in this market
// (especially the GLP-1s). Independent labs measure the actual mg of peptide in the vial; this
// compares that measured amount against what the label claims and returns a plain verdict.
//
// Purity answers "how clean?", identity answers "is it the right molecule?", content answers
// "did I get the dose I paid for?" — three orthogonal questions buyers constantly conflate.

export interface ContentCheck {
  labeledMg: number | null;
  measuredMg: number | null;
  ratio: number | null;                         // measured / labeled
  verdict: "full" | "underdosed" | "overfilled" | null;
  note: string | null;
}

const EMPTY: ContentCheck = { labeledMg: null, measuredMg: null, ratio: null, verdict: null, note: null };

// Parse mg figures out of a string. Returns every distinct value found.
function mgValues(s: string): number[] {
  return [...s.matchAll(/(\d+(?:\.\d+)?)\s*mg\b/gi)].map((m) => Number(m[1])).filter((n) => Number.isFinite(n) && n > 0);
}

/**
 * Compare the independently-measured content against the labeled amount.
 * Only runs for clean single-compound records — blends (multiple compounds / multiple mg
 * figures) and IU-only or content-less reports return null, never a guess.
 */
export function checkContent(sampleName: string, measuredContent: string | null): ContentCheck {
  if (!measuredContent) return EMPTY;
  // A blend lists several peptides — not a single-dose comparison. Detect it two ways:
  //  - the sample name uses blend markers (+ / , GLOW/KLOW/stack/blend) or names >1 dose, or
  //  - the measured-content string has NAMED compounds between its numbers (e.g.
  //    "BPC-157 5.46 mg; TB-500 5.47 mg") — as opposed to a dual-vial single compound
  //    ("22.46 mg; 22.39 mg"), which is fine and we take the first value.
  const sampleBlend = /[+/]|glow|klow|blend|stack/i.test(sampleName) || mgValues(sampleName).length >= 2;
  const contentNames = /[a-z]{2,}/i.test(measuredContent.replace(/[0-9.,;+/()[\]{}\s-]/g, "").replace(/mg|ml|iu|mcg/gi, ""));
  const labeled = mgValues(sampleName);
  const measured = mgValues(measuredContent);
  if (sampleBlend || contentNames || labeled.length !== 1 || measured.length === 0) return EMPTY;

  const labeledMg = labeled[0];
  const measuredMg = measured[0];               // first measured mg (dual-vial reports list two)
  const ratio = measuredMg / labeledMg;
  // Real fills run a little generous; underdosing is the fraud. Bands:
  //   < 0.90  underdosed · 0.90–1.20 full · > 1.20 overfilled (generous, not a problem)
  const verdict = ratio < 0.9 ? "underdosed" : ratio > 1.2 ? "overfilled" : "full";
  const pct = Math.round(ratio * 100);
  const note = verdict === "underdosed"
    ? `Measured ${measuredMg} mg against ${labeledMg} mg labeled — only ${pct}% of the dose. Underfilled vials are the most common way to overcharge for the actual peptide.`
    : verdict === "overfilled"
    ? `Measured ${measuredMg} mg against ${labeledMg} mg labeled (${pct}%) — more than labeled, a generous fill.`
    : `Measured ${measuredMg} mg against ${labeledMg} mg labeled (${pct}%) — the dose is there.`;
  return { labeledMg, measuredMg, ratio, verdict, note };
}

/**
 * How many certificates per vendor measured short of the label, and how many ran generous.
 *
 * One batch read for the whole market. Three separate surfaces compose a verdict — the cron, the
 * vendor page and the directory — and each needs the same answer; deriving it three different ways
 * is how they came to disagree in the first place.
 */
export async function doseCountsByVendor(
  db: { query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }> },
): Promise<Map<string, { underdosed: number; overfilled: number }>> {
  const { rows } = await db.query<{ vendor_slug: string | null; sample_name: string | null; measured_content: string | null }>(
    `SELECT vendor_slug, sample_name, measured_content
       FROM lab_test_records
      WHERE vendor_slug IS NOT NULL AND measured_content IS NOT NULL`,
  );
  const out = new Map<string, { underdosed: number; overfilled: number }>();
  for (const row of rows) {
    if (!row.vendor_slug) continue;
    const verdict = checkContent(row.sample_name ?? "", row.measured_content).verdict;
    if (verdict !== "underdosed" && verdict !== "overfilled") continue;
    const entry = out.get(row.vendor_slug) ?? { underdosed: 0, overfilled: 0 };
    if (verdict === "underdosed") entry.underdosed += 1; else entry.overfilled += 1;
    out.set(row.vendor_slug, entry);
  }
  return out;
}

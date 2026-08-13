// One grade, read by every surface.
//
// The letter is derived by `gradeFromVerdict` from the composed verdict. That derivation is
// expensive (it loads ~10 evidence seams per vendor), so it runs on a schedule and writes the
// result to the vendor row. Market cards, product pages and the vendor report then all read the
// SAME stored value — rather than each recomputing and risking a different answer on each surface,
// which is exactly how a trust product ends up contradicting itself.
import type { SqlConnection } from "@/server/db/client";
import { getDatabase } from "@/server/db/client";
import { composeVerdictForVendorSlug } from "./trust-graph";
import { gradeFromVerdict, type GradeBand, type GradeLetter, type VialGradeResult } from "./grade";
import { getVendorBySlug } from "@/server/catalog/repository";

export interface StoredGrade {
  letter: GradeLetter | null;
  band: GradeBand;
  headline: string;
  rationale: string;
  summary: string;
  weighed: number;
  verifiedCount: number;
  gradedAt: string | null;
}

/** Shape a stored row back into the same object the grade card renders from. */
export function toStoredGrade(row: {
  grade_letter?: string | null; grade_band?: string | null; grade_headline?: string | null;
  grade_rationale?: string | null; grade_summary?: string | null;
  grade_weighed?: number | string | null; grade_verified?: number | string | null;
  graded_at?: string | Date | null;
}): StoredGrade | null {
  // No graded_at means this vendor has never been graded — that is different from "graded, and the
  // answer was no letter". Callers must be able to tell those apart.
  if (!row.graded_at || !row.grade_band) return null;
  return {
    letter: (row.grade_letter as GradeLetter | null) ?? null,
    band: row.grade_band as GradeBand,
    headline: row.grade_headline ?? "",
    rationale: row.grade_rationale ?? "",
    summary: row.grade_summary ?? "",
    weighed: Number(row.grade_weighed ?? 0),
    verifiedCount: Number(row.grade_verified ?? 0),
    gradedAt: row.graded_at instanceof Date ? row.graded_at.toISOString() : String(row.graded_at),
  };
}

async function writeGrade(db: SqlConnection, slug: string, grade: VialGradeResult, summary: string) {
  await db.query(
    `UPDATE organizations
     SET grade_letter=$2, grade_band=$3, grade_headline=$4, grade_rationale=$5, grade_summary=$6,
         grade_weighed=$7::int, grade_verified=$8::int, graded_at=NOW(), updated_at=NOW()
     WHERE slug=$1`,
    [slug, grade.letter, grade.band, grade.headline, grade.rationale, summary, grade.weighed, grade.verifiedCount],
  );
}

/**
 * Store an already-computed grade. The vendor page computes the grade live from seams it has
 * already loaded; writing it back keeps the cheap copies on market/product cards in step without
 * paying for a second derivation.
 */
export async function persistVendorGrade(
  slug: string, grade: VialGradeResult, summary: string, connection?: SqlConnection,
): Promise<void> {
  const db = connection ?? await getDatabase();
  await writeGrade(db, slug, grade, summary);
}

/** Recompute and store the grade for one vendor. Returns null for an untracked slug. */
export async function recomputeVendorGrade(slug: string, connection?: SqlConnection): Promise<VialGradeResult | null> {
  const db = connection ?? await getDatabase();
  const composed = await composeVerdictForVendorSlug(slug);
  if (!composed) return null;
  const vendor = await getVendorBySlug(slug);
  const grade = gradeFromVerdict(composed.composed, { coaCount: vendor?.coaCount ?? 0, listingCount: vendor?.productCount ?? 0 });
  await writeGrade(db, slug, grade, composed.composed.summary);
  return grade;
}

/**
 * Recompute grades for every live vendor.
 *
 * `budgetMs` lets a serverless caller stop cleanly; ungraded vendors simply get picked up on the
 * next run, and stale-first ordering means nothing starves.
 */
export async function recomputeAllVendorGrades(
  options: { connection?: SqlConnection; budgetMs?: number; limit?: number } = {},
): Promise<{ graded: number; skipped: number; budgetExhausted: boolean }> {
  const started = Date.now();
  const db = options.connection ?? await getDatabase();
  const rows = (await db.query<{ slug: string }>(
    `SELECT slug FROM organizations
     WHERE organization_type='vendor'
     ORDER BY graded_at ASC NULLS FIRST
     LIMIT $1`,
    [options.limit ?? 500],
  )).rows;

  let graded = 0, skipped = 0, budgetExhausted = false;
  for (const { slug } of rows) {
    if (options.budgetMs != null && Date.now() - started > options.budgetMs) { budgetExhausted = true; break; }
    try {
      const result = await recomputeVendorGrade(slug, db);
      if (result) graded += 1; else skipped += 1;
    } catch {
      // One vendor's evidence failing to load must not abandon the rest of the run.
      skipped += 1;
    }
  }
  return { graded, skipped, budgetExhausted };
}

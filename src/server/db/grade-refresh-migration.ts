// Recompute every stored vendor grade once, so a grading CORRECTION reaches the surfaces that
// actually show it.
//
// Vendor grades are materialized: the detail page computes live, but the directory, the listing
// cards and the search tiles all read `organizations.grade_*`. Two grading bugs were fixed today —
// an adverse verdict being discarded for any vendor with no listings, and 11 real storefronts
// carrying a rationale stating they "don't sell direct" — and neither reached those surfaces,
// because the stored copy only refreshes on the daily collect cron.
//
// That left the corrected text live on vendor pages while 120 stale copies of the false claim sat
// in the directory's tooltips. A fix that is only true on the page nobody lands on first is not a
// fix.
//
// SAFE TO RUN AT BOOT, measured rather than assumed: a full recompute of 89 vendors took 4.9s
// locally. The budget bounds it well under the route ceiling, stale-first ordering means an
// exhausted budget simply resumes on the next cron, recomputeAllVendorGrades already isolates a
// per-vendor failure, and the whole call is wrapped — a grade is not worth a failed boot. An
// earlier migration bug took production down, and that lesson is applied here.
import type { SqlConnection } from "./client";
import { recomputeAllVendorGrades } from "../verify/grade-store";

export async function refreshAllVendorGrades(db: SqlConnection): Promise<void> {
  try {
    const result = await recomputeAllVendorGrades({ connection: db, budgetMs: 45_000, limit: 500 });
    console.log(`[grade-refresh] regraded ${result.graded}, skipped ${result.skipped}, budgetExhausted=${result.budgetExhausted}`);
  } catch (error) {
    console.error("[grade-refresh] skipped:", error);
  }
}

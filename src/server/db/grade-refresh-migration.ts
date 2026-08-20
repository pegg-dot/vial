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


// ⚠️ DISABLED. Shipping this as boot work took production down: `/` and `/vendors` timed out at 45s
// while cached routes still served, because the recompute runs INSIDE the boot path that every cold
// serverless instance must finish before it answers its first request. 4.9s measured against local
// PGlite did not predict it — production is Postgres over the network, every query pays round-trip
// latency, and 89 vendors x several queries each blew straight past the function ceiling.
//
// The measurement was real; the inference from it was wrong. A local single-process embedded
// database is not a model for a networked one, and I should not have treated it as one.
//
// The version is KEPT and made a no-op rather than removed, so instances that already recorded 48
// stay consistent with those that did not. The grade refresh now belongs where it always belonged:
// the daily collect cron, which is already sized to cover the whole vendor list in one run.
export async function refreshAllVendorGrades(): Promise<void> {
  return;
}

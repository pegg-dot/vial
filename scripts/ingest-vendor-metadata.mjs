// Ingest real vendor metadata: Trustpilot ratings + founding year / location.
//
// Trustpilot is recorded as another aggregator source (additive — it folds into the composed
// trust verdict and shows on the vendor page alongside the other trackers). Founding year and
// location are merged onto the vendor record (never overwriting existing values with blanks).
//
// Live-data write to the dev DB. Gated; run with the dev server STOPPED.
//   VIALGRADE_LIVE_INGEST_APPROVED=true node --import tsx scripts/ingest-vendor-metadata.mjs
process.env.VIALGRADE_SEED_FIXTURES ||= "false";
import { readFileSync, existsSync } from "node:fs";
import { getDatabase } from "../src/server/db/client.ts";
import { recordAggregatorRating } from "../src/server/external/repository.ts";
import { recordCollectorRun } from "../src/server/health/data-health.ts";

if (process.env.VIALGRADE_LIVE_INGEST_APPROVED !== "true") { console.log("Refusing to run: set VIALGRADE_LIVE_INGEST_APPROVED=true."); process.exit(1); }

const file = new URL("./data/vendor-trustpilot.json", import.meta.url);
if (!existsSync(file)) { console.log("No vendor-trustpilot.json found."); process.exit(1); }
const rows = JSON.parse(readFileSync(file, "utf8"));
const db = await getDatabase();

let trustpilot = 0, meta = 0;
for (const v of rows) {
  if (v.trustpilotScore != null && v.trustpilotUrl) {
    await recordAggregatorRating(db, {
      vendorSlug: v.slug,
      source: "Trustpilot",
      score: Number(v.trustpilotScore),
      maxScore: 5,
      testCount: v.trustpilotReviews != null ? Number(v.trustpilotReviews) : null,
      summary: `${v.trustpilotScore}/5 on Trustpilot${v.trustpilotReviews ? ` across ${v.trustpilotReviews} reviews` : ""}. ${v.sourceNote ?? ""}`.trim(),
      sourceUrl: v.trustpilotUrl,
    });
    trustpilot += 1;
  }
  // Merge founding year / location without ever wiping an existing value with a blank.
  if ((v.founded && String(v.founded).trim()) || (v.location && v.location.trim())) {
    await db.query(
      `UPDATE organizations
         SET founded = COALESCE(NULLIF($2,''), founded),
             location = COALESCE(NULLIF($3,''), location),
             updated_at = NOW()
       WHERE slug = $1 AND organization_type = 'vendor'`,
      [v.slug, String(v.founded ?? ""), String(v.location ?? "")],
    );
    meta += 1;
  }
}
await recordCollectorRun(db, { collector: "trustpilot", target: "vendor-metadata", items: trustpilot, ok: true });
console.log(`Recorded ${trustpilot} Trustpilot ratings · merged metadata for ${meta} vendors.`);
process.exit(0);

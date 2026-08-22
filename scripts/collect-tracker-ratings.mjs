process.env.VIALGRADE_SEED_FIXTURES ||= "false"; // never re-seed demo fixtures from a live-data script
// Collect third-party tracker ratings for every vendor we hold a domain for.
//
// The Reputation dimension read `absent` for almost every vendor, because all three of its inputs
// were files somebody typed by hand: 28 review summaries, 17 aggregator rows, and a community
// table empty for all 90 vendors. Peptigrity is an independent peptide-shop tracker that publishes
// a schema.org AggregateRating per shop, and the shop node names its own domain — so attribution
// is verified rather than guessed.
//
//   VIALGRADE_LIVE_INGEST_APPROVED=true node --import tsx scripts/collect-tracker-ratings.mjs [--dry]
// Run with the dev server STOPPED (file-backed PGlite is single-writer).
import { getDatabase } from "../src/server/db/client.ts";
import { acquireStoreLock } from "../src/server/db/store-lock.ts";
import { fetchShopRating, ratingForDomain, normalizeDomain } from "../src/server/collect/tracker-ratings.ts";
import { recordAggregatorRating } from "../src/server/external/repository.ts";
import { recordCollectorRun } from "../src/server/health/data-health.ts";
import { vendorDomains } from "./lib/vendor-domains.mjs";

const DRY = process.argv.includes("--dry");
if (!DRY && process.env.VIALGRADE_LIVE_INGEST_APPROVED !== "true") {
  console.log("Refusing to run: set VIALGRADE_LIVE_INGEST_APPROVED=true (or pass --dry).");
  process.exit(1);
}

// The file-backed store is single-writer; two writers corrupt it. Claim it before opening.
acquireStoreLock("collect-tracker-ratings");
const db = await getDatabase();
const vendors = await vendorDomains(db);

// The existing hand-curated `peptigrity` rows hold a different metric — a 94/100 trust score with
// lab-test counts and average purity. This collects the COMMUNITY STAR RATING, which is a separate
// signal from the same site. Writing it under the same source key would overwrite richer data with
// poorer data on a unique (vendor_slug, source) conflict, so it gets its own key and both survive.
const SOURCE = "peptigrity-community";
const BASE = "https://peptigrity.com/shops";
const PAUSE_MS = 900;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Their slugs take two shapes: the domain with dots replaced by dashes, and occasionally the raw
// domain. Try both — a 404 on the first is not evidence the shop is untracked.
const candidateUrls = (domain) => {
  const d = normalizeDomain(domain);
  return [`${BASE}/${d.replace(/\./g, "-")}`, `${BASE}/${d}`];
};

console.log(`${DRY ? "[dry run] " : ""}Looking up ${vendors.length} vendors on peptigrity…\n`);

let found = 0, missing = 0, rejected = 0, first = true;
for (const v of vendors) {
  if (!first) await sleep(PAUSE_MS);
  first = false;

  let rating = null, usedUrl = null;
  for (const url of candidateUrls(v.domain)) {
    const parsed = await fetchShopRating(url);
    // The page has to be about THIS vendor. A redirect or a recycled slug otherwise attaches one
    // shop's reputation to another, which is the worst thing this product can get wrong.
    const confirmed = ratingForDomain(parsed, v.domain);
    if (confirmed) { rating = confirmed; usedUrl = url; break; }
    if (parsed && !confirmed) rejected += 1;
  }

  if (!rating) {
    missing += 1;
    console.log(`  ·  ${v.slug.padEnd(26)} not tracked`);
    continue;
  }

  found += 1;
  const summary = `Peptigrity community rates ${rating.domain} ${rating.ratingValue}/${rating.bestRating} from ${rating.ratingCount} community review${rating.ratingCount === 1 ? "" : "s"}.`;
  if (!DRY) {
    await recordAggregatorRating(db, {
      vendorSlug: v.slug, source: SOURCE,
      score: rating.ratingValue, maxScore: rating.bestRating,
      testCount: null, avgPurity: null, wouldBuyAgainPct: null,
      summary, sourceUrl: usedUrl,
    });
  }
  console.log(`  ★ ${v.slug.padEnd(26)} ${String(rating.ratingValue).padStart(4)}/${rating.bestRating}  (${rating.ratingCount} reviews)`);
}

// A run that found almost nothing is a run that did not work — say so rather than let a blocked
// scrape read as "the market has no reputation data".
const healthy = vendors.length === 0 || found / vendors.length >= 0.1;
if (!DRY) await recordCollectorRun(db, { collector: "tracker-ratings", target: "peptigrity.com", items: found, ok: healthy });

console.log(`\n${DRY ? "[dry run] " : ""}Done. ${found} rated, ${missing} not tracked, ${rejected} pages rejected for naming a different shop.`);
if (!healthy) console.log("⚠️  Almost nothing came back — treat this run as blocked, not as an empty market.");
if (DRY) console.log("Nothing was written. Re-run without --dry to record.");
process.exit(0);

process.env.VIALGRADE_SEED_FIXTURES ||= "false"; // never re-seed demo fixtures from a live-data script
// Collect Trustpilot buyer ratings for every vendor we hold a domain for.
//
// "Buyer reviews" was one of the two seams keeping the Reputation dimension `absent`, and its only
// source was 28 hand-written summaries. Trustpilot publishes a schema.org AggregateRating per
// profile, but sits behind a bot check that answers 403 to plain fetch and to any simple client —
// so this shells out to the Firecrawl CLI, which renders the page first.
//
// Requires: firecrawl CLI installed and authenticated (`firecrawl --status`). Costs ~1 credit per
// vendor. If it is missing this refuses loudly rather than reporting an empty market.
//
//   VIALGRADE_LIVE_INGEST_APPROVED=true node --import tsx scripts/collect-trustpilot.mjs [--dry] [--limit N]
// Run with the dev server STOPPED (file-backed PGlite is single-writer).
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDatabase } from "../src/server/db/client.ts";
import { acquireStoreLock } from "../src/server/db/store-lock.ts";
import { classifyTrustpilot, normalizeDomain } from "../src/server/collect/tracker-ratings.ts";
import { recordAggregatorRating } from "../src/server/external/repository.ts";
import { recordCollectorRun } from "../src/server/health/data-health.ts";
import { vendorDomains } from "./lib/vendor-domains.mjs";

const run = promisify(execFile);
const DRY = process.argv.includes("--dry");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

if (!DRY && process.env.VIALGRADE_LIVE_INGEST_APPROVED !== "true") {
  console.log("Refusing to run: set VIALGRADE_LIVE_INGEST_APPROVED=true (or pass --dry).");
  process.exit(1);
}

// An unavailable scraper must not look like a market with no reviews.
try {
  const { stdout } = await run("firecrawl", ["--status"]);
  if (!/Authenticated/i.test(stdout)) throw new Error("not authenticated");
} catch {
  console.log("Refusing to run: the firecrawl CLI is missing or not authenticated (`firecrawl --status`).");
  console.log("Trustpilot answers 403 without it, and a blocked scrape must not be recorded as 'no reviews'.");
  process.exit(1);
}

// The file-backed store is single-writer; two writers corrupt it. Claim it before opening.
acquireStoreLock("collect-trustpilot");
const db = await getDatabase();
const vendors = (await vendorDomains(db)).slice(0, LIMIT);

const SOURCE = "Trustpilot";
const WAIT_MS = 4000; // below this the bot check answers instead of the page
const work = mkdtempSync(path.join(tmpdir(), "vg-tp-"));

console.log(`${DRY ? "[dry run] " : ""}Reading Trustpilot for ${vendors.length} vendors…\n`);

// "could not fetch" and "nothing published" are DIFFERENT answers and must never share a counter.
// The first run conflated them and reported 52 vendors as having nothing on Trustpilot when 48 of
// those were requests that failed — the absence/unknown distinction this whole product turns on.
let rated = 0, removed = 0, none = 0, failed = 0, rejected = 0, first = true;

// Sequential requests with no pause got rate-limited: 48 of 58 failed in a batch that each
// succeeded when run alone. One retry, and room to breathe between calls.
const PAUSE_MS = 5000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function scrapeOnce(domain, out) {
  await run("firecrawl", ["scrape", `https://www.trustpilot.com/review/${domain}`, "--wait-for", String(WAIT_MS), "--format", "markdown,rawHtml", "-o", out], { maxBuffer: 64 * 1024 * 1024 });
  const raw = readFileSync(out, "utf8");
  try {
    const j = JSON.parse(raw);
    return { html: j.rawHtml ?? j.data?.rawHtml ?? j.html ?? "", markdown: j.markdown ?? j.data?.markdown ?? "" };
  } catch { return { html: raw, markdown: raw }; }
}
for (const v of vendors) {
  const domain = normalizeDomain(v.domain);
  const out = path.join(work, `${v.slug}.json`);
  if (!first) await sleep(PAUSE_MS);
  first = false;

  // Both formats in ONE scrape: the raw HTML carries the schema.org rating, and the markdown is
  // the text a reader actually sees. Removal must be judged from the latter — Trustpilot ships
  // its whole i18n bundle, removal strings included, inside every page's HTML.
  let page = null;
  for (const attempt of [1, 2]) {
    try { page = await scrapeOnce(domain, out); break; }
    catch { if (attempt === 1) await sleep(PAUSE_MS * 2); }
  }
  if (!page) {
    failed += 1;
    console.log(`  ?  ${v.slug.padEnd(26)} could not fetch — unknown, not absent`);
    continue;
  }
  const { html, markdown } = page;

  // Trustpilot removes profiles it judges to breach its guidelines, which is common in this
  // market. That is a real reputation event, but it is NOT a rating — recording it as one would
  // invent a number. Counted and reported; see the note at the end of the run.
  const { state, rating } = classifyTrustpilot({ html, markdown, domain });

  if (state === "removed") {
    removed += 1;
    console.log(`  ✕ ${v.slug.padEnd(26)} profile removed by Trustpilot`);
    continue;
  }
  if (!rating) {
    none += 1;
    console.log(`  ·  ${v.slug.padEnd(26)} no rating published`);
    continue;
  }

  rated += 1;
  const summary = `Trustpilot rates ${rating.domain} ${rating.ratingValue}/${rating.bestRating} across ${rating.reviewCount} buyer review${rating.reviewCount === 1 ? "" : "s"}.`;
  if (!DRY) {
    await recordAggregatorRating(db, {
      vendorSlug: v.slug, source: SOURCE,
      score: rating.ratingValue, maxScore: rating.bestRating,
      testCount: null, avgPurity: null, wouldBuyAgainPct: null,
      summary, sourceUrl: `https://www.trustpilot.com/review/${rating.domain}`,
    });
  }
  console.log(`  ★ ${v.slug.padEnd(26)} ${String(rating.ratingValue).padStart(4)}/${rating.bestRating}  (${rating.reviewCount} reviews)`);
}

rmSync(work, { recursive: true, force: true });

// A run where most requests never landed is a failed run, whatever the successes look like.
// Recording it as OK is how a rate-limited scrape passes for a market with no reviews.
const asked = vendors.length;
const healthy = asked === 0 || failed / asked <= 0.2;
if (!DRY) await recordCollectorRun(db, { collector: "trustpilot", target: "trustpilot.com", items: rated, ok: healthy });

console.log(`\n${DRY ? "[dry run] " : ""}Done. ${rated} rated, ${removed} profiles removed by Trustpilot, ${none} with nothing published, ${failed} could not be fetched, ${rejected} rejected for naming a different business.`);
if (removed > 0) console.log(`Note: a removed profile is a reputation signal in its own right, but it is not a rating and is not recorded as one.`);
if (!healthy) console.log(`⚠️  ${Math.round((failed / asked) * 100)}% of requests failed — treat this run as rate-limited, not as a market without reviews.`);
if (DRY) console.log("Nothing was written. Re-run without --dry to record.");
process.exit(0);

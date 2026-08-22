// Ingest the broader data seams — aggregator ratings, vendor operational signals, offers, news,
// and compound literature — from their gathered JSON files. Idempotent. Gated. Run with dev stopped.
//   VIALGRADE_LIVE_INGEST_APPROVED=true node --import tsx scripts/ingest-external-data.mjs
process.env.VIALGRADE_SEED_FIXTURES ||= "false";
import { readFileSync, existsSync } from "node:fs";
import { getDatabase } from "../src/server/db/client.ts";
import { acquireStoreLock } from "../src/server/db/store-lock.ts";
import { recordAggregatorRating, recordVendorSignals, recordVendorOffer, recordNewsItem, recordCompoundResearch, setCompoundRegulatory } from "../src/server/external/repository.ts";
import { recordCollectorRun } from "../src/server/health/data-health.ts";

if (process.env.VIALGRADE_LIVE_INGEST_APPROVED !== "true") { console.log("Refusing to run: set VIALGRADE_LIVE_INGEST_APPROVED=true."); process.exit(1); }
const DATA = new URL("./data/", import.meta.url);
// The files that feed a DEPLOYED surface live under src/ so the serverless bundle contains them
// (scripts/data/ is not bundled, which is why /news was empty in production). This script reads
// them from their new home so the manual path and the continuous collector share one source.
const BUNDLED = new URL("../src/server/data/", import.meta.url);
const read = (n) => {
  for (const base of [BUNDLED, DATA]) {
    const url = new URL(n, base);
    if (existsSync(url)) return JSON.parse(readFileSync(url, "utf8"));
  }
  return null;
};
// The file-backed store is single-writer; two writers corrupt it. Claim it before opening.
acquireStoreLock("ingest-external-data");
const db = await getDatabase();

const agg = read("aggregator-ratings.json");
if (agg) { for (const r of agg) await recordAggregatorRating(db, r); await recordCollectorRun(db, { collector: "aggregators", target: "peptigrity-batchguild-finnrick", items: agg.length, ok: true }); console.log(`Aggregator ratings: ${agg.length}`); }

const sig = read("vendor-signals.json");
if (sig) { for (const s of sig) await recordVendorSignals(db, s); console.log(`Vendor operational signals: ${sig.length}`); }

const off = read("vendor-offers.json");
if (off) { for (const o of off) await recordVendorOffer(db, o); console.log(`Vendor offers: ${off.length}`); }

const news = read("news-items.json");
if (news) { for (const n of news) await recordNewsItem(db, n); await recordCollectorRun(db, { collector: "news", target: "market", items: news.length, ok: true }); console.log(`News items: ${news.length}`); }

const lit = read("compound-research.json");
if (lit) {
  let findings = 0;
  for (const c of lit) {
    await setCompoundRegulatory(db, c.compoundSlug, c.regulatoryStatus ?? null, c.evidenceSummary ?? null);
    for (const f of (c.findings ?? [])) { await recordCompoundResearch(db, { compoundSlug: c.compoundSlug, ...f }); findings += 1; }
  }
  console.log(`Compound literature: ${lit.length} compounds, ${findings} findings`);
}

console.log("External-data ingest complete.");
process.exit(0);

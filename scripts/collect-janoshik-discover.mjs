process.env.VIALGRADE_SEED_FIXTURES ||= "false"; // never re-seed demo fixtures from a live-data script
// Discover NEW Janoshik public tests and ingest them (plus re-confirm the ones we hold).
//
//   VIALGRADE_LIVE_INGEST_APPROVED=true node --import tsx scripts/collect-janoshik-discover.mjs
//   … --offline   → no network: re-ingest from scripts/data/janoshik-feed-snapshot.html
//                   (used to apply freshly vision-read purities after a live run)
// Run with the dev server STOPPED (file-backed PGlite is single-writer).
//
// ⚠️ 2026-08-30: public.janoshik.com answers every server-side client with a Cloudflare 403, so
// the live fetch below has been failing since at least 2026-08-29 (and no certificate had been
// added since 07-22). Production runs this same loop from the collection queue
// (src/server/collect/lab-janoshik.ts). The path that works today is a person's browser: save the
// portal page, run `node --import tsx scripts/janoshik-capture-to-json.mjs <saved.html>`, commit
// src/server/data/janoshik-feed-capture.json. `--offline` here still re-ingests the on-disk HTML
// snapshot into a laptop database.
//
// The portal shows a bounded window of recent tests; certificates roll off but their verify
// URLs stay valid. Each run captures what's currently listed before it rolls off, refreshes the
// on-disk snapshot, ingests the tests we don't hold yet (minting any newly-named vendors), then
// runs the same-source liveness pass over everything stored. "Not in current feed" means rolled
// off OR delisted — the feed alone cannot distinguish; we say so rather than overclaim.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { getDatabase } from "../src/server/db/client.ts";
import { acquireStoreLock } from "../src/server/db/store-lock.ts";
import { parseJanoshikFeed } from "../src/server/ingest/lab-tests.ts";
import { ingestNewJanoshikTests, applyPurities, annotateTestTypes } from "../src/server/ingest/janoshik-discovery.ts";
import { reconcileLabsFromRegistry } from "../src/server/ingest/lab-tests.ts";
import { fetchJanoshikPortal, annotateJanoshikListings, JanoshikPortalError } from "../src/server/verify/janoshik-verify.ts";
import { computeAndStoreLinkages } from "../src/server/verify/vendor-linkage.ts";
import { recomputeCompoundStats } from "../src/server/ingest/live-sources.ts";
import { projectLiveBatchPassports } from "../src/server/evidence-network/live-passports.ts";
import { projectEvidenceRegistry } from "../src/server/registry/repository.ts";

if (process.env.VIALGRADE_LIVE_INGEST_APPROVED !== "true") { console.log("Refusing to run: set VIALGRADE_LIVE_INGEST_APPROVED=true."); process.exit(1); }

const DATA = new URL("./data/", import.meta.url);
const readJson = (name) => JSON.parse(readFileSync(new URL(name, DATA), "utf8"));
const snapshotFile = new URL("janoshik-feed-snapshot.html", DATA);
const offline = process.argv.includes("--offline");

let entries;
if (offline) {
  console.log("Offline: parsing the on-disk snapshot…");
  entries = parseJanoshikFeed(readFileSync(snapshotFile, "utf8"));
} else {
  console.log("Fetching the live Janoshik public feed…");
  let portal;
  try { portal = await fetchJanoshikPortal(); }
  catch (error) {
    if (error instanceof JanoshikPortalError) { console.error(`The portal refused this client (HTTP ${error.status}) — see the note at the top of this script for the browser-capture path.`); process.exit(1); }
    throw error;
  }
  entries = portal.entries;
  if (entries.length === 0) { console.error("Parsed 0 entries — portal layout may have changed; NOT overwriting the snapshot."); process.exit(1); }
  writeFileSync(snapshotFile, portal.html);
  console.log(`  snapshot refreshed (${entries.length} public tests listed).`);
}

const compounds = readJson("peptide-compounds.json").map((c) => ({ slug: c.slug, name: c.name, aliases: c.aliases }));
const vendors = existsSync(new URL("peptide-vendors.json", DATA))
  ? readJson("peptide-vendors.json").map((v) => ({ slug: v.slug, name: v.name, domain: v.domain }))
  : [];
const purities = existsSync(new URL("janoshik-purities.json", DATA)) ? readJson("janoshik-purities.json") : {};

// The file-backed store is single-writer; two writers corrupt it. Claim it before opening.
acquireStoreLock("collect-janoshik-discover");
const db = await getDatabase();
const res = await ingestNewJanoshikTests(db, entries, { compounds, vendors }, purities);
console.log(`\n${res.newTests.length} test(s) in the feed we didn't hold (feed=${res.feedSize}).`);
if (res.newTests.length) {
  console.log(`  ${res.compoundMatched} resolved to a known compound · ${res.vendorLinked} tied to a vendor · ${res.newVendors.length} brand-new vendor(s)${res.newVendors.length ? `: ${res.newVendors.join(", ")}` : ""}`);
  for (const e of res.newTests) console.log(`  + ${e.testId.padEnd(7)} ${e.sampleName.slice(0, 40).padEnd(42)} client=${(e.client || "—").slice(0, 30)}  ${e.verifyUrl}`);
}

const applied = await applyPurities(db, purities);
if (applied) console.log(`\nBackfilled vision-read certificate values onto ${applied} stored row(s).`);

const typed = await annotateTestTypes(db, entries);
if (typed) console.log(`Annotated analysis type / blind flag on ${typed} stored COA(s).`);

const rec = await reconcileLabsFromRegistry(db);
if (rec.renamed || rec.independenceChanged) console.log(`Reconciled labs: ${rec.renamed} renamed, ${rec.independenceChanged} independence flag(s) corrected.`);

const sync = await annotateJanoshikListings(db, entries);
console.log(`\nLiveness: ${sync.stillListed}/${sync.keysChecked} stored COAs still in the current public feed.`);
if (sync.delisted.length) console.log(`  ⚠️ ${sync.delisted.length} previously-listed cert(s) no longer in the feed (rolled off or delisted — same-source signal): ${sync.delisted.join(", ")}`);

if (res.newTests.length || applied || typed) {
  const { edges } = await computeAndStoreLinkages(db);
  await recomputeCompoundStats(db);
  const proj = await projectLiveBatchPassports(db);
  await projectEvidenceRegistry(db);
  console.log(`\nRecomputed downstream: vendor linkage graph (${edges} edges) + compound stats + ${proj.passports} real batch passports (${proj.vendors} vendors).`);
}

const totals = (await db.query(`SELECT COUNT(*) n, COUNT(purity_pct) p FROM lab_test_records WHERE lab='Janoshik Analytical'`)).rows[0];
console.log(`\nStored Janoshik COAs now: ${totals.n} (${totals.p} with a read purity).`);
process.exit(0);

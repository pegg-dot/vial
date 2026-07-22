// Re-verify every stored COA against Janoshik's LIVE public test database.
//
//   VIAL_LIVE_INGEST_APPROVED=true node --import tsx scripts/collect-janoshik-verify.mjs
// Run with the dev server STOPPED (file-backed PGlite is single-writer).
//
// Our COAs were ingested from a snapshot of this same feed, so this is a liveness check: it confirms
// each certificate is STILL publicly listed by the lab and stamps the recency. A cert that has since
// been pulled shows up in `delisted` — a real trust change worth surfacing.
import { getDatabase } from "../src/server/db/client.ts";
import { fetchJanoshikPortal, annotateJanoshikListings } from "../src/server/verify/janoshik-verify.ts";

if (process.env.VIAL_LIVE_INGEST_APPROVED !== "true") { console.log("Refusing to run: set VIAL_LIVE_INGEST_APPROVED=true."); process.exit(1); }

const db = await getDatabase();
console.log("Fetching Janoshik public feed…");
const { entries } = await fetchJanoshikPortal();
console.log(`  live portal lists ${entries.length} public tests.`);
const res = await annotateJanoshikListings(db, entries);
console.log(`Checked ${res.keysChecked} stored COAs — ${res.stillListed} still publicly listed, ${res.keysChecked - res.stillListed} not currently in the public feed.`);
if (res.delisted.length) console.log(`  ⚠️ ${res.delisted.length} previously-listed cert(s) now DELISTED:`, res.delisted);
process.exit(0);

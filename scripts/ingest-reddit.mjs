// Ingest r/Peptides community reputation for every known vendor.
//
// Reddit's public search blocks datacenter IPs, so this needs an authenticated "script" app.
// Create one at https://reddit.com/prefs/apps (type: "script"), then:
//
//   REDDIT_CLIENT_ID=xxx REDDIT_CLIENT_SECRET=yyy \
//     node --import tsx scripts/ingest-reddit.mjs
//
// Optionally add REDDIT_USERNAME + REDDIT_PASSWORD (your Reddit dev account) to use the
// password grant instead of the userless client_credentials grant.
//
// Run with the dev server STOPPED (file-backed PGlite is single-writer), or against a managed
// DATABASE_URL. Idempotent: re-running refreshes each vendor's stored snapshot.
import { getDatabase } from "../src/server/db/client.ts";
import { hasRedditCreds, ingestVendorReddit } from "../src/server/ingest/reddit.ts";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const vendors = JSON.parse(readFileSync(join(here, "data", "peptide-vendors.json"), "utf8"));

if (!hasRedditCreds()) {
  console.log("Refusing to run: set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET (create a 'script' app at https://reddit.com/prefs/apps).");
  process.exit(1);
}

const db = await getDatabase();
console.log(`Ingesting r/Peptides reputation for ${vendors.length} vendors…\n`);

let ok = 0, blocked = 0;
for (const v of vendors) {
  const signal = await ingestVendorReddit(db, { slug: v.slug, name: v.name });
  if (!signal) { blocked++; console.log(`  ⏸  ${v.name.padEnd(24)} search unavailable (rate-limited or blocked)`); continue; }
  ok++;
  const mark = signal.sentiment === "negative" ? "🔴" : signal.sentiment === "mixed" ? "🟡" : signal.sentiment === "positive" ? "🟢" : "⚪";
  console.log(`  ${mark} ${v.name.padEnd(24)} ${String(signal.mentionCount).padStart(2)} mentions  (${signal.negativeCount} neg / ${signal.positiveCount} pos)  ${signal.authed ? "" : "[public fallback]"}`);
  // Be polite to Reddit's API between requests.
  await new Promise((r) => setTimeout(r, 1500));
}

console.log(`\nDone. ${ok} vendors ingested, ${blocked} unavailable.`);
console.log(`The verify tool and vendor pages now read these stored signals.`);
process.exit(0);

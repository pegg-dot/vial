// Probe every vendor's domain for liveness / exit-scam status and record it.
//
//   VIALGRADE_LIVE_INGEST_APPROVED=true node --import tsx scripts/collect-vendor-status.mjs
// Run with the dev server STOPPED (file-backed PGlite is single-writer).
import { getDatabase } from "../src/server/db/client.ts";
import { probeVendorStatus, recordVendorStatus } from "../src/server/verify/vendor-status.ts";
import { vendorDomains } from "./lib/vendor-domains.mjs";

if (process.env.VIALGRADE_LIVE_INGEST_APPROVED !== "true") { console.log("Refusing to run: set VIALGRADE_LIVE_INGEST_APPROVED=true."); process.exit(1); }

// Probe ALL vendors — including red-flagged/defunct ones, to confirm they're actually gone.
// Read from the catalogue, not the 34-row seed file: that mismatch is why Site status covered
// 37% of vendors while the other 56 silently had none.
const db = await getDatabase();
const vendors = await vendorDomains(db);
console.log(`Probing ${vendors.length} vendor domains…`);
const tally = {};
for (const v of vendors) {
  const s = await probeVendorStatus(v.domain);
  await recordVendorStatus(db, v.slug, s);
  tally[s.status] = (tally[s.status] ?? 0) + 1;
  const mark = s.status === "operating" ? "🟢" : s.status === "blocked" ? "⚪" : s.status === "redirected" ? "🟡" : "🔴";
  console.log(`  ${mark} ${v.slug.padEnd(26)} ${s.status}${s.redirectHost ? " → " + s.redirectHost : ""}${s.httpCode ? " (" + s.httpCode + ")" : ""}`);
}
console.log(`\nDone.`, tally);
process.exit(0);

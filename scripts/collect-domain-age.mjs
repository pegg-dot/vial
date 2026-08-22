process.env.VIALGRADE_SEED_FIXTURES ||= "false"; // never re-seed demo fixtures from a live-data script
// Collect every vendor's domain registration date and record it as an operational signal.
//
// The trust graph has always known how to read a domain-age note — a storefront that appeared
// four months ago is a real risk signal in a market where scam shops churn inside a year. It
// never had a producer. The only source was 18 rows typed by hand in vendor-signals.json, and
// they were never loaded, so every vendor's "Business signals" dimension rendered empty.
//
//   VIALGRADE_LIVE_INGEST_APPROVED=true node --import tsx scripts/collect-domain-age.mjs [--dry]
// Run with the dev server STOPPED (file-backed PGlite is single-writer).
import { getDatabase } from "../src/server/db/client.ts";
import { acquireStoreLock } from "../src/server/db/store-lock.ts";
import { fetchDomainRegistrationDate, domainAgeNote, YOUNG_DOMAIN_RE } from "../src/server/collect/domain-age.ts";
import { recordDomainAge } from "../src/server/external/repository.ts";
import { recordCollectorRun } from "../src/server/health/data-health.ts";
import { vendorDomains } from "./lib/vendor-domains.mjs";

const DRY = process.argv.includes("--dry");
if (!DRY && process.env.VIALGRADE_LIVE_INGEST_APPROVED !== "true") {
  console.log("Refusing to run: set VIALGRADE_LIVE_INGEST_APPROVED=true (or pass --dry).");
  process.exit(1);
}

// The file-backed store is single-writer; two writers corrupt it. Claim it before opening.
acquireStoreLock("collect-domain-age");
const db = await getDatabase();
const rows = await vendorDomains(db);

console.log(`${DRY ? "[dry run] " : ""}Reading registration dates for ${rows.length} vendor domains…\n`);

// rdap.org throttles. Without a pause between lookups the run "succeeds" while silently
// reporting most of the market as ageless — see the note in src/server/collect/domain-age.ts.
const PAUSE_MS = 1_200;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let recorded = 0, unknown = 0, young = 0, first = true;
for (const v of rows) {
  const domain = v.domain;
  if (!first) await sleep(PAUSE_MS);
  first = false;

  const registered = await fetchDomainRegistrationDate(domain);
  const note = domainAgeNote(registered);

  if (!note) {
    unknown += 1;
    console.log(`  ·  ${v.slug.padEnd(26)} ${String(domain).padEnd(30)} unknown`);
    continue;
  }

  const isYoung = YOUNG_DOMAIN_RE.test(note);
  if (isYoung) young += 1;
  if (!DRY) await recordDomainAge(db, v.slug, note);
  recorded += 1;

  const age = note.match(/\(~([^)]+)\)/)?.[1] ?? "?";
  console.log(`  ${isYoung ? "⚠️" : "  "} ${v.slug.padEnd(26)} ${String(domain).padEnd(30)} ${registered}  (~${age.replace("~", "")})`);
}

// A run where most lookups came back empty is a run that did not work. Recording it as OK is how
// a throttled collector passes for a healthy one — so the health surface is told the truth, and
// the recorded rows (which are real) are kept either way.
const asked = recorded + unknown;
const healthy = asked === 0 || unknown / asked <= 0.3;
if (!DRY) await recordCollectorRun(db, { collector: "domain-age", target: "rdap.org", items: recorded, ok: healthy });

console.log(`\n${DRY ? "[dry run] " : ""}Done. ${recorded} recorded, ${unknown} unknown, ${young} young enough to count as a caution signal.`);
if (!healthy) console.log(`⚠️  ${Math.round((unknown / asked) * 100)}% came back empty — treat this run as throttled, not as a market with no domain ages.`);
if (DRY) console.log("Nothing was written. Re-run without --dry to record.");
process.exit(0);

// Data-health report: how fresh is each data type, and did any collector silently break?
// Read-only. Run any time (locally or on the deploy, e.g. after the nightly collectors):
//   node --import tsx scripts/data-health.mjs
process.env.VIALGRADE_SEED_FIXTURES ||= "false";
import { getDatabase } from "../src/server/db/client.ts";
import { getDataFreshness, getBrokenCollectors } from "../src/server/health/data-health.ts";

const db = await getDatabase();
const fresh = await getDataFreshness(db);
const broken = await getBrokenCollectors(db);

const bar = (b) => `fresh ${b.fresh} · aging ${b.aging} · stale ${b.stale} · never ${b.missing}  (of ${b.total})`;
console.log(`\n=== VialGrade data health — ${new Date(fresh.asOf).toISOString().slice(0, 16).replace("T", " ")} UTC ===\n`);
console.log("Freshness (each data type by age of its last check):");
console.log(`  Independent COAs   ${bar(fresh.coas)}      [fresh ≤30d · stale >90d]`);
console.log(`  Live listings      ${bar(fresh.listings)}  [fresh ≤14d · stale >45d]`);
console.log(`  Vendor reviews     ${bar(fresh.reviews)}   [fresh ≤60d · stale >180d]`);
console.log(`  Vendor status      ${bar(fresh.vendorStatus)}  [fresh ≤14d · stale >45d]`);

console.log(`\nCollector health:`);
if (broken.length === 0) {
  console.log("  ✓ No broken collectors — every source that ever yielded data still does.");
} else {
  console.log(`  ⚠️ ${broken.length} collector(s) look BROKEN (yielded data before, none now — likely a site change/block):`);
  for (const b of broken) console.log(`     ${b.collector.padEnd(12)} ${b.target.padEnd(28)} ${b.previousItems} → ${b.latestItems}${b.latestOk ? "" : " (failed)"}  last ${new Date(b.latestRanAt).toISOString().slice(0, 10)}`);
}

const stale = fresh.coas.stale + fresh.listings.stale + fresh.reviews.stale;
console.log(`\nBottom line: ${broken.length} broken collector(s), ${stale} stale record(s). ${broken.length === 0 && stale === 0 ? "Data is current." : "Re-run the collectors."}\n`);
process.exit(0);

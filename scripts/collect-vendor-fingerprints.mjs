// Collect vendor web fingerprints and rebuild the operator-linkage graph.
//
// Fetches each vendor's homepage and extracts the machine identifiers an operator rarely changes
// between "independent" storefronts — Google Analytics / GTM / Facebook-pixel IDs, Shopify handle
// — then recomputes vendor links (web IDs + shared COA lots + shared upstream manufacturers).
//
//   VIAL_LIVE_INGEST_APPROVED=true node --import tsx scripts/collect-vendor-fingerprints.mjs
// Run with the dev server STOPPED (file-backed PGlite is single-writer).
import { readFileSync } from "node:fs";
import { getDatabase } from "../src/server/db/client.ts";
import { recordFingerprint, computeAndStoreLinkages } from "../src/server/verify/vendor-linkage.ts";

if (process.env.VIAL_LIVE_INGEST_APPROVED !== "true") { console.log("Refusing to run: set VIAL_LIVE_INGEST_APPROVED=true."); process.exit(1); }

const vendors = JSON.parse(readFileSync(new URL("./data/peptide-vendors.json", import.meta.url), "utf8")).filter((v) => !v.redFlag);
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const RX = {
  ga: /\bG-[A-Z0-9]{6,12}\b/g,
  ua: /\bUA-\d{4,}-\d{1,3}\b/g,
  gtm: /\bGTM-[A-Z0-9]{4,10}\b/g,
  fb: /fbq\(\s*['"]init['"]\s*,\s*['"](\d{10,17})['"]/g,
  shopify: /([a-z0-9][a-z0-9-]*)\.myshopify\.com/g,
};

async function fingerprintsFor(domain) {
  for (const base of [`https://${domain}`, `https://www.${domain}`]) {
    try {
      const r = await fetch(base, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) continue;
      const h = await r.text();
      const out = [];
      for (const [kind, rx] of Object.entries(RX)) for (const m of new Set([...h.matchAll(rx)].map((x) => x[1] ?? x[0]))) out.push({ kind: kind === "ua" ? "ga" : kind, value: m });
      return out;
    } catch { /* try www */ }
  }
  return [];
}

const db = await getDatabase();
console.log(`Collecting web fingerprints for ${vendors.length} vendors…`);
let withFp = 0;
for (const v of vendors) {
  const fps = await fingerprintsFor(v.domain);
  for (const f of fps) await recordFingerprint(db, v.slug, f.kind, f.value);
  if (fps.length) { withFp += 1; console.log(`  ${v.slug.padEnd(24)} ${fps.map((f) => `${f.kind}:${f.value}`).join("  ")}`); }
}
console.log(`\n${withFp}/${vendors.length} vendors fingerprinted. Rebuilding linkage graph…`);
const { edges } = await computeAndStoreLinkages(db);
const linked = (await db.query(`SELECT COUNT(DISTINCT vendor_slug) n FROM vendor_links`)).rows[0].n;
console.log(`Built ${edges} link edges across ${linked} vendors.`);
process.exit(0);

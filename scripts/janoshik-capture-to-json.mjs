// Turn a page a PERSON saved from public.janoshik.com into the committed capture that the
// lab-janoshik-capture collector ingests in production.
//
//   node --import tsx scripts/janoshik-capture-to-json.mjs "~/Downloads/Public Tests - Janoshik Analytical.html" [--captured-at 2026-08-30T03:06:18Z]
//
// Why a person: public.janoshik.com sits behind Cloudflare, which answers every server-side client
// with 403 "Attention Required" (Chrome UA, curl and an honest bot UA alike, probed 2026-08-30)
// while rendering normally in a browser. Open the portal, save the page (File → Save Page As, HTML
// only is enough), run this, commit src/server/data/janoshik-feed-capture.json. The collector
// records what the capture lists and we do not hold — idempotent on verify_url — on its next daily
// run. It never stamps liveness from a capture; that stays with the live kind.
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { parseJanoshikFeed } from "../src/server/ingest/lab-tests.ts";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file) { console.error("usage: node --import tsx scripts/janoshik-capture-to-json.mjs <saved-portal-page.html> [--captured-at ISO]"); process.exit(1); }
const html = readFileSync(file.replace(/^~/, process.env.HOME ?? "~"), "utf8");
const entries = parseJanoshikFeed(html);
if (entries.length === 0) { console.error("Parsed 0 public tests — is this the saved portal page, and not a Cloudflare block page?"); process.exit(1); }
const flag = args.indexOf("--captured-at");
const capturedAt = flag >= 0 && args[flag + 1] ? new Date(args[flag + 1]).toISOString() : statSync(file).mtime.toISOString();
const out = {
  capturedAt,
  capturedFrom: "https://public.janoshik.com/",
  capturedBy: "owner-browser",
  columns: ["testId", "verifyUrl", "sampleName", "client", "manufacturer", "note", "sticky"],
  rows: entries.map((e) => [e.testId, e.verifyUrl, e.sampleName, e.client, e.manufacturer, e.note, 0]),
};
const dest = new URL("../src/server/data/janoshik-feed-capture.json", import.meta.url);
writeFileSync(dest, JSON.stringify(out) + "\n");
console.log(`${entries.length} public tests (captured ${capturedAt}) → src/server/data/janoshik-feed-capture.json. Commit it; lab-janoshik-capture ingests it on its next daily run.`);

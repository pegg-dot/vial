// Live smoke: fetch the real BPC-157 vendor pages + Janoshik feed through the SAME
// SSRF-safe fetcher + extractor the pipeline uses, and print what would be proposed.
// Proves the real sources parse today. Network only, no DB writes.
//   node --import tsx scripts/live-source-smoke.mjs
import { safeFetch } from "../src/server/refresh/safe-fetch.ts";
import { extractClaimCandidates } from "../src/server/agents/extract.ts";
import { REAL_BPC157_VENDORS, JANOSHIK_SOURCE } from "../src/server/ingest/bpc157.ts";

function ct(value) {
  const c = value.split(";")[0].trim().toLowerCase();
  return c === "text/html" || c === "application/json" || c === "application/ld+json" ? c : "text/plain";
}

const targets = [
  ...REAL_BPC157_VENDORS.map((v) => ({ label: v.name, url: v.productUrl, host: v.domain, profile: v.parserProfile })),
  { label: JANOSHIK_SOURCE.label, url: JANOSHIK_SOURCE.url, host: JANOSHIK_SOURCE.hostname, profile: "document" },
];

for (const t of targets) {
  try {
    const res = await safeFetch(t.url, {
      allowedHostnames: [t.host, `www.${t.host}`],
      allowedContentTypes: ["text/html", "application/json", "application/ld+json", "text/plain"],
      timeoutMs: 20000,
      maxResponseBytes: 5_000_000,
    });
    const claims = extractClaimCandidates({
      sourceType: t.profile === "document" ? "lab-report" : "vendor-page",
      canonicalLocation: res.url,
      label: `${t.label} smoke`,
      targetListingSlug: "smoke",
      rawContent: res.body,
      contentType: ct(res.contentType),
      parserProfile: t.profile,
      actor: "smoke",
    });
    const summary = claims.map((c) => `${c.predicate}=${JSON.stringify(c.value)}`).join(", ") || "(no claims)";
    console.log(`✅ ${t.label}\n   ${res.status} ${res.bytes}b via ${res.resolvedIp} → ${summary}`);
  } catch (error) {
    console.log(`⛔ ${t.label}\n   ${error instanceof Error ? error.message : String(error)}`);
  }
}
process.exit(0);

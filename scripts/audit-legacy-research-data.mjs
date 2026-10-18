/**
 * Read-only inventory of legacy VialGrade data that might support a research product.
 * This only reads tracked local JSON. It does not query production, make network calls,
 * ingest sources, validate claims, or change research/commerce mode.
 * It intentionally prints aggregate metadata, never vendor names, source excerpts,
 * browsing histories, user data, or record-level accusations.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const specs = [
  ["compounds", "scripts/data/peptide-compounds.json", ["slug", "name", "aliases"]],
  ["vendors", "scripts/data/peptide-vendors.json", ["domain", "name"]],
  ["vendorCoas", "scripts/data/vendor-coas.json", ["url", "batch", "testedAt"]],
  ["flaggedCoas", "scripts/data/vendor-coas-flagged.json", ["lot", "testedAt"]],
  ["vendorSelfCoas", "scripts/data/vendor-self-coas.json", ["url", "batch", "testedAt"]],
  ["janoshikPurities", "scripts/data/janoshik-purities.json", ["purityPct", "batch", "testedAt"]],
  ["vendorReviews", "scripts/data/vendor-reviews.json", ["sources", "summary"]],
  ["vendorSignals", "scripts/data/vendor-signals.json", ["sourceUrl"]],
  ["aggregatorRatings", "scripts/data/aggregator-ratings.json", ["sourceUrl"]],
  ["vendorOffers", "scripts/data/vendor-offers.json", ["sourceUrl"]],
  ["vendorTrustpilot", "scripts/data/vendor-trustpilot.json", ["trustpilotUrl"]],
  ["regulatoryStatus", "src/server/data/compound-regulatory-status.json", ["slug", "sourceUrls", "fdaApproved"]],
  ["compoundResearch", "src/server/data/compound-research.json", ["compoundSlug", "findings"]],
  ["regulatoryActions", "src/server/data/regulatory-actions.json", ["sourceUrl", "isPrimarySource"]],
  ["newsItems", "src/server/data/news-items.json", ["sourceUrl"]],
];

function present(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function load(relativePath) {
  return JSON.parse(readFileSync(resolve(root, relativePath), "utf8"));
}

function records(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  throw new Error("Unexpected JSON data shape");
}

const datasets = {};
for (const [name, relativePath, fields] of specs) {
  const data = load(relativePath);
  const rows = records(data);
  if (!rows.every(row => row && typeof row === "object" && !Array.isArray(row))) {
    throw new Error("Unexpected records in " + relativePath);
  }
  const populated = Object.fromEntries(
    fields.map(field => [field, rows.filter(row => present(row[field])).length]),
  );
  datasets[name] = { path: relativePath, count: rows.length, populated };
}

const compounds = load("scripts/data/peptide-compounds.json");
const aliases = new Map();
for (const compound of compounds) {
  for (const name of [compound.name, compound.slug, ...(compound.aliases ?? [])]) {
    if (typeof name !== "string") continue;
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!normalized) continue;
    if (!aliases.has(normalized)) aliases.set(normalized, new Set());
    aliases.get(normalized).add(compound.slug);
  }
}
const overlappingAliases = [...aliases.values()].filter(slugs => slugs.size > 1).length;
const legacyFindings = load("src/server/data/compound-research.json")
  .flatMap(compound => compound.findings ?? []);
const regulatoryRefs = load("src/server/data/compound-regulatory-status.json")
  .flatMap(compound => compound.sourceUrls ?? []);
const report = {
  scope: "Git-tracked JSON only. Not live database contents. Not proof of accuracy, rights, or regulatory status.",
  networkRequests: 0,
  databaseAccess: false,
  commerceChanges: false,
  datasets,
  identityCandidates: {
    listedAliases: compounds.reduce((sum, compound) => sum + (compound.aliases?.length ?? 0), 0),
    distinctNormalizedNamesAndAliases: aliases.size,
    collisionsWithinThisFile: overlappingAliases,
  },
  citationCandidates: {
    researchFindings: legacyFindings.length,
    researchFindingsWithSourceUrl: legacyFindings.filter(item => present(item.sourceUrl)).length,
    regulatorySourceReferences: regulatoryRefs.length,
    distinctRegulatoryReferenceUrls: new Set(regulatoryRefs).size,
  },
  warning: "Everything counted is an unverified candidate. Recheck source facts, ownership, dates, licensing, sample identity and human-review gates before reuse. Exclude consumer interaction and attribution data.",
};
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("VialGrade legacy research-data inventory (tracked files only)");
  for (const [name, data] of Object.entries(datasets)) {
    console.log(name + ": " + data.count + " records; field coverage " + JSON.stringify(data.populated));
  }
  console.log("Identity candidates:", JSON.stringify(report.identityCandidates));
  console.log("Citation candidates:", JSON.stringify(report.citationCandidates));
  console.log(report.warning);
}

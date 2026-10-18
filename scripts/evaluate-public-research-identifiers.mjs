/**
 * Explicit, read-only ClinicalTrials.gov candidate-relevance benchmark.
 *
 * Usage:
 *   node --import tsx scripts/evaluate-public-research-identifiers.mjs
 *   node --import tsx scripts/evaluate-public-research-identifiers.mjs --live
 *
 * No production DB, no saved queries, no visitor data, no vendor data.
 * --live is opt-in. Query terms are fixed to the three public research topics
 * and three manually scoped development-code leads. Printed results are samples,
 * NEVER complete registry counts or evidence of efficacy/safety.
 */
import {
  RESEARCH_IDENTITY_CANDIDATES,
  classifyTrialAssociation,
  getCandidateQueries,
} from "../src/server/intelligence/topic-identity-candidates.ts";

const live = process.argv.includes("--live");
if (!live) {
  console.log(JSON.stringify({
    mode: "offline",
    description: "Candidate scientific identity map; use --live for official registry lookup",
    topics: RESEARCH_IDENTITY_CANDIDATES.map(topic => ({
      topic: topic.key,
      queries: getCandidateQueries(topic.key),
      aliasEvidence: topic.aliases.map(alias => ({ value: alias.value, url: alias.sourceUrl })),
    })),
    publicProductEffect: false,
    productionDatabaseAccess: false,
  }, null, 2));
  process.exit(0);
}

const PAGE_SIZE = 100;
const MAX_REQUESTS = 6;
const totalRequests = RESEARCH_IDENTITY_CANDIDATES.reduce(
  (n, topic) => n + getCandidateQueries(topic.key).length, 0,
);
if (totalRequests > MAX_REQUESTS) throw new Error("Unexpected research query expansion");

async function fetchRegistrySample(query) {
  const url = new URL("https://clinicaltrials.gov/api/v2/studies");
  url.searchParams.set("query.term", query);
  url.searchParams.set("pageSize", String(PAGE_SIZE));
  url.searchParams.set("countTotal", "true");
  url.searchParams.set("format", "json");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("ClinicalTrials.gov request failed");
  const body = await response.json();
  if (!body || typeof body !== "object" || !Array.isArray(body.studies)) {
    throw new Error("Unexpected registry schema");
  }
  const records = new Map();
  for (const study of body.studies) {
    const id = study?.protocolSection?.identificationModule?.nctId;
    if (/^NCT[0-9]{8}$/.test(id) && study.protocolSection?.identificationModule?.briefTitle) {
      records.set(id, study);
    }
  }
  if (body.studies.length && records.size === 0) {
    throw new Error("No parseable registry records");
  }
  return {
    sample: records,
    reportedTotal: Number.isSafeInteger(body.totalCount) ? body.totalCount : null,
    pageLimit: PAGE_SIZE,
  };
}

const report = {
  checkedAt: new Date().toISOString(),
  source: "ClinicalTrials.gov v2 studies API",
  resultScope: "Comparison of two server-defined keyword result samples, not a systematic registry review",
  caveat: "Even an intervention-name match can be a comparator and is not proof of benefit, safety, approval or clinical relevance. No record is added to the public product.",
  topics: [],
  publicProductEffect: false,
  productionDatabaseAccess: false,
};
for (const identity of RESEARCH_IDENTITY_CANDIDATES) {
  const queries = getCandidateQueries(identity.key);
  try {
    const canonical = await fetchRegistrySample(queries[0]);
    const extras = await Promise.all(queries.slice(1).map(fetchRegistrySample));
    const canonicalIds = new Set(canonical.sample.keys());
    const aliasOnly = new Map();
    for (const sample of extras) {
      for (const [id, study] of sample.sample) {
        if (!canonicalIds.has(id)) aliasOnly.set(id, study);
      }
    }
    const associations = {
      "intervention-recorded": 0,
      "named-in-title": 0,
      "search-hit-only": 0,
    };
    for (const study of aliasOnly.values()) {
      associations[classifyTrialAssociation(study, identity)] += 1;
    }
    report.topics.push({
      key: identity.key,
      canonicalQuery: queries[0],
      aliasQueries: queries.slice(1),
      canonicalReturnedSample: canonical.sample.size,
      canonicalSourceReportedTotal: canonical.reportedTotal,
      aliasReturnedSamples: extras.map(x => x.sample.size),
      aliasSourceReportedTotals: extras.map(x => x.reportedTotal),
      aliasOnlyComparedToCanonicalSample: aliasOnly.size,
      aliasOnlyAssociationCategories: associations,
      providerStatus: "available",
      samplePageLimitPerQuery: PAGE_SIZE,
      note: "These categories describe mentions in registry fields, not clinical outcomes.",
    });
  } catch {
    report.topics.push({
      key: identity.key,
      providerStatus: "unavailable",
      note: "At least one source query failed. No missing/zero-evidence inference is possible.",
    });
  }
}
console.log(JSON.stringify(report, null, 2));

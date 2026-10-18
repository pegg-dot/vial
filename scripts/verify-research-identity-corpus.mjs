/**
 * Re-check a provisional corpus of public ClinicalTrials.gov study metadata.
 *
 * Default: read local fixture only. --live: opt-in official API requests for
 * pinned NCT IDs, max 50 unique lookups, concurrency 4, no file writes.
 *
 * This checks only where identifiers appear in public study metadata.
 * It is NOT a scientific truth/relevance benchmark or an independent review.
 * No user research queries, accounts, vendor data or commerce APIs are touched.
 */
import { readFileSync } from "node:fs";
import {
  classifyTrialAssociation,
  getResearchIdentityCandidate,
} from "../src/server/intelligence/topic-identity-candidates.ts";

const fixture = JSON.parse(readFileSync(new URL(
  "../tests/fixtures/clinical-trial-association-corpus.json",
  import.meta.url,
), "utf8"));
const cases = fixture.cases;
if (fixture.schemaVersion !== 1 || !Array.isArray(cases) || cases.length !== 45) {
  throw new Error("Unexpected or unreviewed research corpus schema");
}
const references = new Set();
const offlineMismatches = [];
for (const item of cases) {
  const key = item.topic + ":" + item.nctId;
  if (references.has(key) || !/^NCT\d{8}$/.test(item.nctId)) {
    throw new Error("Duplicate or malformed sample identifier");
  }
  references.add(key);
  if (item.sourceUrl !== "https://clinicaltrials.gov/study/" + item.nctId) {
    throw new Error("Non-official source URL");
  }
  const identity = getResearchIdentityCandidate(item.topic);
  if (!identity) throw new Error("Unexpected topic");
  const observed = classifyTrialAssociation(item.record, identity);
  if (observed !== item.expected) offlineMismatches.push({
    topic: item.topic, nctId: item.nctId, expected: item.expected, observed,
  });
}
if (offlineMismatches.length) {
  console.log(JSON.stringify({ status: "offline-mismatch", offlineMismatches }, null, 2));
  process.exitCode = 1;
} else if (!process.argv.includes("--live")) {
  console.log(JSON.stringify({
    status: "offline-pass", samples: cases.length,
    source: fixture.origin, capturedAt: fixture.capturedAt,
    independentlyReviewed: false, recordsRefetched: 0,
    caveat: "Field association is not scientific relevance or proof of clinical outcomes.",
  }, null, 2));
} else {
  const ids = [...new Set(cases.map(x => x.nctId))];
  if (ids.length > 50) throw new Error("Unapproved number of source requests");
  const observedAt = new Date().toISOString();
  const returned = new Map();
  const errors = [];
  let index = 0;
  async function readWorker() {
    while (index < ids.length) {
      const id = ids[index++];
      try {
        const response = await fetch("https://clinicaltrials.gov/api/v2/studies/" + id, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error("Registry unavailable");
        const study = await response.json();
        const protocol = study?.protocolSection;
        if (protocol?.identificationModule?.nctId !== id) {
          throw new Error("Unexpected source identifier");
        }
        returned.set(id, {
          protocolSection: {
            identificationModule: {
              nctId: id,
              briefTitle: protocol.identificationModule.briefTitle,
              officialTitle: protocol.identificationModule.officialTitle ?? null,
            },
            armsInterventionsModule: {
              interventions: (protocol.armsInterventionsModule?.interventions ?? [])
                .map(x => ({ name: x.name, otherNames: x.otherNames ?? [] })),
            },
          },
        });
      } catch {
        errors.push(id);
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, readWorker));
  const differences = [];
  const changedMetadata = [];
  for (const row of cases) {
    const current = returned.get(row.nctId);
    if (!current) continue;
    const identity = getResearchIdentityCandidate(row.topic);
    const observed = classifyTrialAssociation(current, identity);
    if (observed !== row.expected) differences.push({
      topic: row.topic, nctId: row.nctId, expected: row.expected, observed,
    });
    if (JSON.stringify(current) !== JSON.stringify(row.record)) {
      changedMetadata.push({ topic: row.topic, nctId: row.nctId });
    }
  }
  const summary = {
    status: errors.length ? "provider-partial-failure" : differences.length ? "field-match-drift" : "pass",
    capturedAt: fixture.capturedAt, checkedAt: observedAt,
    independentlyReviewed: false, sampleCases: cases.length,
    sourceRequests: ids.length, successfulRequests: returned.size,
    failedIdentifiers: errors, associationChanges: differences,
    metadataChanges: changedMetadata,
    caution: "A date or field change must be checked at source; no clinical efficacy, safety or market conclusions.",
  };
  console.log(JSON.stringify(summary, null, 2));
  if (errors.length || differences.length) process.exitCode = 1;
}

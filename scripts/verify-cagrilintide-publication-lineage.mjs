/**
 * Manual live-source QA only. Run with:
 * node --import tsx scripts/verify-cagrilintide-publication-lineage.mjs
 *
 * No user identifiers, provider credentials, purchases, DB writes,
 * snapshots or production actions. Exits 2 for provider unavailability,
 * 1 for source drift that needs human review, 0 only for checked matches.
 * NEVER interpret this audit as clinical or legal validation.
 */
import {
  getCagrilintideAudit,
  getAuditCounts,
} from "../src/server/intelligence/cagrilintide-study-audit.ts";

const expected = [
  { nctId: "NCT03856047", pmid: "34798060", role: "RESULT", registryResults: "present" },
  { nctId: "NCT04982575", pmid: "37364590", role: "BACKGROUND", registryResults: "present" },
  { nctId: "NCT05804162", pmid: "39279639", role: "RESULT", registryResults: "not-shown" },
];

const audit = await getCagrilintideAudit();
const problems = [];
let unavailable = false;

for (const item of expected) {
  const row = audit.rows.find(candidate => candidate.selection.nctId === item.nctId);
  if (!row?.available) {
    unavailable = true;
    problems.push(item.nctId + ": ClinicalTrials.gov record unavailable");
    continue;
  }
  const original = row.study.registryReferences.find(reference => reference.pmid === item.pmid);
  const indexed = row.study.pubmedChecks.find(check => check.reference.pmid === item.pmid);
  if (!original) {
    problems.push(item.nctId + ": expected protocol-linked PMID missing or changed");
    continue;
  }
  if (original.role !== item.role) {
    problems.push(item.nctId + ": original registry citation role changed to " + original.role);
  }
  if (row.study.registryResults !== item.registryResults) {
    problems.push(item.nctId + ": registry results-section state changed to " + row.study.registryResults);
  }
  if (indexed?.secondaryIdMatch === "unavailable" || !indexed?.article) {
    unavailable = true;
    problems.push(item.nctId + ": PubMed verification was unavailable");
  } else if (indexed.secondaryIdMatch !== "confirmed") {
    problems.push(item.nctId + ": PubMed no longer indexes expected exact NCT/PMID link");
  }
}

const combination = audit.rows.find(row => row.selection.nctId === "NCT07564414");
if (!combination?.available) {
  unavailable = true;
  problems.push("NCT07564414: combination-name record unavailable");
} else if (combination.study.matchLocation === "intervention-recorded") {
  problems.push("NCT07564414: intervention association changed; re-review molecule vs combination");
}

const summary = {
  assembledAt: audit.assembledAt,
  sampledStudyCount: audit.rows.length,
  sampledReferences: audit.rows.filter(row => row.available)
    .reduce((count, row) => count + row.study.registryReferences.length, 0),
  corroboratedExactNctPubMedPairs: audit.rows.filter(row => row.available)
    .reduce((total, row) => total + row.study.pubmedChecks.filter(item => item.secondaryIdMatch === "confirmed").length, 0),
  corroboratedRegistryResultLabeledPapers: getAuditCounts(audit).directResultPapersCorroborated,
  providerUnavailable: unavailable,
  sourceMetadataDriftOrFailure: problems.length > 0,
  issues: problems,
  warning: "This is a dated, selected-source reproducibility check, NOT complete trial coverage, clinical analysis or historical diff.",
};

console.log(JSON.stringify(summary, null, 2));
if (unavailable) process.exitCode = 2;
else if (problems.length) process.exitCode = 1;

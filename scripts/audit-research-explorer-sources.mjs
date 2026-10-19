/**
 * A read-only, manually invoked source-integrity check for the curated explorer.
 *
 * Run:
 *   node --import tsx scripts/audit-research-explorer-sources.mjs
 *   node --import tsx scripts/audit-research-explorer-sources.mjs --live
 *
 * Default is OFFLINE; --live makes at most 16 PubChem and 5 official
 * ClinicalTrials.gov requests, sequentially and gently rate-limited.
 * This does not scrape article text, create accounts, touch any databases,
 * log personal searches, or call vendor/commerce services.
 */
import {
  RESEARCH_SUBJECTS,
  RESEARCH_THEMES,
} from "../src/lib/research-explorer.ts";

const LIVE = process.argv.includes("--live");
const failures = [];
const warnings = [];
const observed = { identities: 0, interventions: 0 };

const slugs = new Set(RESEARCH_SUBJECTS.map(subject => subject.slug));
if (RESEARCH_SUBJECTS.length !== 16 || slugs.size !== 16) failures.push("Incorrect curated subject set.");
if (RESEARCH_THEMES.length !== 4) failures.push("Incorrect theme set.");

for (const subject of RESEARCH_SUBJECTS) {
  if (!subject.identityCaveat || !subject.studyQuestion || !subject.scientistAngle || !subject.analystAngle) {
    failures.push(subject.slug + ": research context is missing");
  }
  if (!/^https:\/\/pubchem\.ncbi\.nlm\.nih\.gov\/(?:compound|substance)\/\d+$/.test(subject.referenceUrl)) {
    failures.push(subject.slug + ": unexpected molecular record URL");
  }
  if (subject.sampleTrial && !/^NCT\d{8}$/.test(subject.sampleTrial)) {
    failures.push(subject.slug + ": malformed study ID");
  }
}

async function checkedFetch(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
  return response;
}
const pause = () => new Promise(resolve => setTimeout(resolve, 425));

if (LIVE) {
  for (const subject of RESEARCH_SUBJECTS) {
    const match = /^https:\/\/pubchem\.ncbi\.nlm\.nih\.gov\/compound\/(\d+)$/.exec(subject.referenceUrl);
    const identityUrl = match
      ? "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/" + match[1] + "/property/Title/JSON"
      : subject.referenceUrl;
    try {
      const response = await checkedFetch(identityUrl);
      if (match) {
        const json = await response.json();
        if (json.PropertyTable?.Properties?.[0]?.CID !== Number(match[1])) throw new Error("Wrong compound CID response");
        const title = json.PropertyTable.Properties[0].Title;
        if (!title || title.startsWith("CID ")) warnings.push(subject.slug + ": unnamed PubChem title, human check needed");
      }
      observed.identities++;
    } catch (error) {
      failures.push(subject.slug + ": identity request failed: " + String(error));
    }
    await pause();
  }

  for (const subject of RESEARCH_SUBJECTS.filter(item => item.sampleTrial)) {
    try {
      const response = await checkedFetch("https://clinicaltrials.gov/api/v2/studies/" + subject.sampleTrial);
      const record = await response.json();
      const actualId = record.protocolSection?.identificationModule?.nctId;
      if (actualId !== subject.sampleTrial) throw new Error("Wrong NCT ID returned");
      const interventions = record.protocolSection?.armsInterventionsModule?.interventions ?? [];
      if (!interventions.some(intervention => (intervention.name ?? "").toLowerCase().includes(subject.name.toLowerCase()))) {
        throw new Error("Molecule no longer appears in registered intervention name");
      }
      observed.interventions++;
    } catch (error) {
      failures.push(subject.slug + ": registry request failed: " + String(error));
    }
    await pause();
  }
}

console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  live: LIVE,
  curatedSubjects: RESEARCH_SUBJECTS.length,
  themes: RESEARCH_THEMES.length,
  sampleTrialIds: RESEARCH_SUBJECTS.filter(subject => subject.sampleTrial).length,
  sourceIdentityRequestsConfirmed: observed.identities,
  sampleTrialInterventionsConfirmed: observed.interventions,
  warnings,
  failures,
  note: "Source identity and registered intervention name checks only. NOT publication accuracy, efficacy, materials suitability, regulatory clearance or a clinical review.",
}, null, 2));
if (failures.length) process.exitCode = 1;

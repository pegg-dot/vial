/**
 * Optional, read-only original-source audit for the limited guided case.
 * Default offline validation makes NO requests. --live only fetches
 * metadata from NIH, at most 2 PubChem, 1 ClinicalTrials.gov and 1
 * PubMed EFetch request, with fixed identifiers.
 *
 * Never downloads papers, captures visitor queries, calls commerce, saves
 * to databases, or infers clinical outcomes from publication titles.
 */
import { load } from "cheerio";
import { MAGAININ_PEXIGANAN_CASE } from "../src/lib/research-guided-case.ts";

const live = process.argv.includes("--live");
const failures = [];
const warnings = [];
const ids = new Set(MAGAININ_PEXIGANAN_CASE.sources.map(s => s.id));
for (const observation of MAGAININ_PEXIGANAN_CASE.observations) {
  for (const sourceId of observation.sourceIds) if (!ids.has(sourceId)) failures.push("Untraceable evidence: " + sourceId);
}
for (const source of MAGAININ_PEXIGANAN_CASE.sources) {
  const u = new URL(source.url);
  if (u.protocol !== "https:" || !["pubchem.ncbi.nlm.nih.gov", "pubmed.ncbi.nlm.nih.gov", "clinicaltrials.gov"].includes(u.hostname)) {
    failures.push("Unexpected source hostname: " + source.id);
  }
}

async function get(url, type = "json") {
  const response = await fetch(url, {
    headers: { accept: type === "xml" ? "application/xml" : "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > 800_000) throw new Error("Source response too large");
  return type === "xml" ? response.text() : response.json();
}
const delay = () => new Promise(resolve => setTimeout(resolve, 430));
const inspected = { pubchem: [], registry: null, pubmed: [] };

if (live) {
  for (const [name, cid] of [["Magainin 2", 16130189], ["Pexiganan", 16132253]]) {
    try {
      const record = await get("https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/" + cid + "/property/Title/JSON");
      const result = record.PropertyTable?.Properties?.[0];
      if (result?.CID !== cid) throw new Error("Wrong CID");
      inspected.pubchem.push({ name, cid, title: result.Title });
    } catch (error) {
      failures.push("PubChem identity source " + cid + ": " + String(error));
    }
    await delay();
  }

  try {
    const study = await get("https://clinicaltrials.gov/api/v2/studies/NCT01594762");
    const p = study.protocolSection ?? {};
    const actualId = p.identificationModule?.nctId;
    const interventions = p.armsInterventionsModule?.interventions ?? [];
    if (actualId !== "NCT01594762" || !interventions.some(x => /pexiganan/i.test(x.name ?? ""))) {
      throw new Error("Registry lacks the pinned exact trial and intervention reference");
    }
    inspected.registry = {
      nctId: actualId,
      interventionMatch: true,
      resultsSectionReported: study.hasResults === true,
      title: p.identificationModule?.briefTitle,
    };
  } catch (error) {
    failures.push("Pinned trial source: " + String(error));
  }
  await delay();

  try {
    const endpoint = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=12719236,19010301&retmode=xml";
    const xml = await get(endpoint, "xml");
    const $ = load(xml, { xml: true });
    const articles = new Map();
    $("PubmedArticle").each((_, element) => {
      const node = $(element);
      const pmid = node.find("MedlineCitation > PMID").first().text().trim();
      const title = node.find("MedlineCitation > Article > ArticleTitle").first().text().replace(/\s+/g, " ").trim();
      const roles = node.find("PublicationType").map((_, tag) => $(tag).text()).get();
      if (pmid && title) articles.set(pmid, { pmid, title, types: roles });
    });
    const original = articles.get("12719236");
    const review = articles.get("19010301");
    if (!original || !/MSI-78/i.test(original.title)) throw new Error("Primary-paper ID/title did not match");
    if (!review || !/pexiganan/i.test(review.title) || !review.types.some(t => /^Review$/i.test(t))) {
      throw new Error("Review ID/title/type did not match");
    }
    inspected.pubmed = [original, review];
  } catch (error) {
    failures.push("PubMed article metadata: " + String(error));
  }
}
console.log(JSON.stringify({
  reviewedAt: new Date().toISOString(),
  live,
  claimSteps: MAGAININ_PEXIGANAN_CASE.observations.length,
  sources: MAGAININ_PEXIGANAN_CASE.sources.length,
  ...inspected,
  failures,
  warnings,
  scope: "Original identifiers, article titles/types and trial intervention only. No article conclusions, clinical results or copyright permissions validated.",
}, null, 2));
if (failures.length) process.exitCode = 1;

/**
 * Cross-check only publications explicitly referenced by pinned official
 * ClinicalTrials.gov protocol records against NLM's PubMed XML metadata.
 *
 * One bounded EFetch request retrieves PubMed bibliographic metadata and the
 * article's ClinicalTrials.gov databank accessions. The library never displays,
 * exports or stores PubMed abstracts/full text; no personal query/behavior,
 * account, payment, COA or commercial historical data is involved.
 *
 * Important: a registry RESULT/BACKGROUND label and PubMed's NCT accession
 * each have distinct provenance. They cannot establish clinical conclusions,
 * statutory results-reporting compliance, or the correctness of a registry tag.
 */
import { load } from "cheerio";

const PMID = /^[1-9]\d{4,9}$/;
const NCT = /^NCT\d{8}$/;
const CACHE_SECONDS = 21_600;
const MAX_PAIRS = 12;
const MAX_XML_LENGTH = 800_000;

export type RegistryReferenceRole = "RESULT" | "BACKGROUND" | "DERIVED" | "OTHER";

export type TrialRegistryReference = {
  pmid: string;
  role: RegistryReferenceRole;
  citation: string | null;
};

export type PubMedArticleMetadata = {
  pmid: string;
  title: string;
  journal: string | null;
  publicationDate: string | null;
  url: string;
};

export type TrialPublicationCheck = {
  nctId: string;
  reference: TrialRegistryReference;
  article: PubMedArticleMetadata | null;
  /** Only "confirmed" means PubMed itself lists the exact NCT databank ID. */
  secondaryIdMatch: "confirmed" | "not-corroborated" | "unavailable";
};

type PubMedIndexedArticle = {
  article: PubMedArticleMetadata;
  /** Only exact ClinicalTrials.gov databank accessions, not text search hits. */
  trialIds: string[];
};

function plainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function text(value: unknown, limit: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, limit) : null;
}

/** Extract original registry-assigned roles; do not merge BACKGROUND with RESULT. */
export function registryPubMedReferences(study: unknown): TrialRegistryReference[] {
  const references = plainObject(plainObject(plainObject(study).protocolSection).referencesModule).references;
  if (!Array.isArray(references)) return [];
  const seen = new Set<string>();
  return references.slice(0, 24).flatMap((raw): TrialRegistryReference[] => {
    const entry = plainObject(raw);
    const pmid = text(entry.pmid, 12);
    if (!pmid || !PMID.test(pmid) || seen.has(pmid)) return [];
    seen.add(pmid);
    const rawType = text(entry.type, 25);
    const role: RegistryReferenceRole = rawType === "RESULT" || rawType === "BACKGROUND" || rawType === "DERIVED"
      ? rawType : "OTHER";
    return [{ pmid, role, citation: text(entry.citation, 450) }];
  }).slice(0, 8);
}

/**
 * Parses official PubMed EFetch XML into *only* citations and indexed NCT IDs.
 * Abstracts, medical findings, full text and non-ClinicalTrials databanks are
 * intentionally excluded from the output; external DTDs are not retrieved.
 */
export function parsePubMedXml(xml: unknown, requested: readonly string[]): Map<string, PubMedIndexedArticle> {
  const indexed = new Map<string, PubMedIndexedArticle>();
  if (typeof xml !== "string" || !xml.includes("<PubmedArticleSet") || xml.length > MAX_XML_LENGTH) return indexed;
  const allowed = new Set(requested.filter(pmid => PMID.test(pmid)));
  if (!allowed.size) return indexed;
  const $ = load(xml, { xml: true });
  $("PubmedArticle").slice(0, 100).each((_, element) => {
    const root = $(element);
    const pmid = root.find("MedlineCitation > PMID").first().text().trim();
    if (!allowed.has(pmid) || indexed.has(pmid)) return;
    const title = text(root.find("MedlineCitation > Article > ArticleTitle").first().text(), 320);
    if (!title) return;
    const journal = text(root.find("MedlineCitation > Article > Journal > ISOAbbreviation").first().text(), 100);
    const published = root.find("MedlineCitation > Article > Journal > JournalIssue > PubDate").first();
    const publicationDate = text([
      published.find("Year").first().text(),
      published.find("Month").first().text(),
      published.find("Day").first().text(),
    ].filter(Boolean).join(" ") || published.find("MedlineDate").first().text(), 55);
    const trialIds = new Set<string>();
    root.find("MedlineCitation > Article > DataBankList > DataBank").each((_, dataBank) => {
      const bank = $(dataBank);
      if (bank.find("DataBankName").first().text().trim() !== "ClinicalTrials.gov") return;
      bank.find("AccessionNumberList > AccessionNumber").each((_, accession) => {
        const id = $(accession).text().trim();
        if (NCT.test(id)) trialIds.add(id);
      });
    });
    indexed.set(pmid, {
      article: {
        pmid,
        title,
        journal,
        publicationDate,
        url: "https://pubmed.ncbi.nlm.nih.gov/" + pmid + "/",
      },
      trialIds: [...trialIds],
    });
  });
  return indexed;
}

/**
 * ONE official NIH EFetch call for all pinned PMID records. Minimal cost and
 * no multiple-ESearch burst that could trigger the NIH 3-request/sec rate
 * limit. Failure leaves the original registry citation visible but unverified.
 */
export async function crossCheckRegistryPublications(
  candidates: readonly { nctId: string; reference: TrialRegistryReference }[],
): Promise<TrialPublicationCheck[]> {
  const unique = new Map<string, { nctId: string; reference: TrialRegistryReference }>();
  for (const row of candidates) {
    if (!NCT.test(row.nctId) || !PMID.test(row.reference.pmid)) continue;
    const key = row.nctId + ":" + row.reference.pmid;
    if (!unique.has(key)) unique.set(key, row);
    if (unique.size === MAX_PAIRS) break;
  }
  const selected = [...unique.values()];
  if (!selected.length) return [];

  const pmids = [...new Set(selected.map(row => row.reference.pmid))];
  let indexed = new Map<string, PubMedIndexedArticle>();
  try {
    const endpoint = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi");
    endpoint.searchParams.set("db", "pubmed");
    endpoint.searchParams.set("id", pmids.join(","));
    endpoint.searchParams.set("retmode", "xml");
    const response = await fetch(endpoint.toString(), {
      headers: { accept: "application/xml" },
      next: { revalidate: CACHE_SECONDS },
      signal: AbortSignal.timeout(7_000),
    });
    if (!response.ok) throw new Error("NIH PubMed source unavailable");
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_XML_LENGTH) throw new Error("Oversize source");
    const xml = await response.text();
    indexed = parsePubMedXml(xml, pmids);
  } catch {
    // Registry source still stands. Never turn an unreachable provider into
    // a claim that the paper is missing or its link failed verification.
  }

  return selected.map(({ nctId, reference }) => {
    const paper = indexed.get(reference.pmid);
    return {
      nctId,
      reference,
      article: paper?.article ?? null,
      secondaryIdMatch: !paper ? "unavailable"
        : paper.trialIds.includes(nctId) ? "confirmed" : "not-corroborated",
    };
  });
}

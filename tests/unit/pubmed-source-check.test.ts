import { afterEach, describe, expect, it, vi } from "vitest";
import {
  crossCheckRegistryPublications,
  parsePubMedXml,
  registryPubMedReferences,
  type TrialRegistryReference,
} from "@/server/intelligence/pubmed-source-check";

function registry(references: unknown) {
  return { protocolSection: { referencesModule: { references } } };
}

const SAMPLE_XML = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<PubmedArticleSet>',
  '<PubmedArticle><MedlineCitation><PMID>39279639</PMID><Article>',
  '<ArticleTitle>Cagrilintide QTc &amp; source review</ArticleTitle>',
  '<Journal><JournalIssue><PubDate><Year>2024</Year><Month>Dec</Month></PubDate></JournalIssue><ISOAbbreviation>Diabetes Obes Metab</ISOAbbreviation></Journal>',
  '<Abstract><AbstractText>Do not leak abstract or efficacy statements in exports.</AbstractText></Abstract>',
  '<DataBankList><DataBank><DataBankName>ClinicalTrials.gov</DataBankName><AccessionNumberList><AccessionNumber>NCT05804162</AccessionNumber></AccessionNumberList></DataBank>',
  '<DataBank><DataBankName>Other Registry</DataBankName><AccessionNumberList><AccessionNumber>NCT99999999</AccessionNumber></AccessionNumberList></DataBank></DataBankList>',
  '</Article></MedlineCitation></PubmedArticle>',
  '<PubmedArticle><MedlineCitation><PMID>37364590</PMID><Article>',
  '<ArticleTitle>Independent trial paper</ArticleTitle>',
  '<Journal><JournalIssue><PubDate><MedlineDate>2023 Jul-Aug</MedlineDate></PubDate></JournalIssue><ISOAbbreviation>Lancet</ISOAbbreviation></Journal>',
  '<DataBankList><DataBank><DataBankName>ClinicalTrials.gov</DataBankName><AccessionNumberList><AccessionNumber>NCT04982575</AccessionNumber></AccessionNumberList></DataBank></DataBankList>',
  '</Article></MedlineCitation></PubmedArticle>',
  '<PubmedArticle><MedlineCitation><PMID>34798060</PMID><Article><ArticleTitle>Only citation without NCT indexing</ArticleTitle>',
  '<Journal><JournalIssue><PubDate><Year>2021</Year></PubDate></JournalIssue><ISOAbbreviation>Lancet</ISOAbbreviation></Journal>',
  '</Article></MedlineCitation></PubmedArticle>',
  '</PubmedArticleSet>',
].join("\n");

afterEach(() => vi.unstubAllGlobals());

describe("ClinicalTrials.gov reference provenance", () => {
  it("preserves original reference labels and does not relabel BACKGROUND as RESULT", () => {
    expect(registryPubMedReferences(registry([
      { pmid: "39279639", type: "RESULT", citation: " QTc record  " },
      { pmid: "37364590", type: "BACKGROUND", citation: " Trial paper " },
      { pmid: "34798060", type: "DERIVED", citation: " Earlier source " },
      { pmid: "1234567", type: "OTHER_TYPE", citation: " Not recognized " },
    ]))).toEqual([
      { pmid: "39279639", role: "RESULT", citation: "QTc record" },
      { pmid: "37364590", role: "BACKGROUND", citation: "Trial paper" },
      { pmid: "34798060", role: "DERIVED", citation: "Earlier source" },
      { pmid: "1234567", role: "OTHER", citation: "Not recognized" },
    ]);
  });

  it("rejects spoofed IDs, duplicate references and irrelevant top-level data", () => {
    expect(registryPubMedReferences(registry([
      { pmid: "javascript:alert(1)", type: "RESULT" },
      { pmid: "000000000", type: "RESULT" },
      { pmid: "3", type: "RESULT" },
      { pmid: "39279639", type: "RESULT", citation: "a".repeat(1200) },
      { pmid: "39279639", type: "BACKGROUND" },
    ]))).toEqual([{ pmid: "39279639", role: "RESULT", citation: "a".repeat(450) }]);
    expect(registryPubMedReferences({ references: [{ pmid: "39279639" }] })).toEqual([]);
    expect(registryPubMedReferences(null)).toEqual([]);
  });
});

describe("PubMed indexed source association", () => {
  it("parses only requested PMID metadata and exact ClinicalTrials.gov accession fields", () => {
    const parsed = parsePubMedXml(SAMPLE_XML, ["39279639", "37364590", "40404040"]);
    expect(parsed.size).toBe(2);
    expect(parsed.get("39279639")).toEqual({
      article: {
        pmid: "39279639",
        title: "Cagrilintide QTc & source review",
        journal: "Diabetes Obes Metab",
        publicationDate: "2024 Dec",
        url: "https://pubmed.ncbi.nlm.nih.gov/39279639/",
      },
      trialIds: ["NCT05804162"],
    });
    expect(parsed.get("37364590")?.trialIds).toEqual(["NCT04982575"]);
    expect(parsed.get("40404040")).toBeUndefined();
    expect(JSON.stringify([...parsed.values()])).not.toContain("Do not leak abstract");
    expect(JSON.stringify([...parsed.values()])).not.toContain("NCT99999999");
  });

  it("rejects wrong shapes and excessive content rather than attempting unverifiable parsing", () => {
    expect(parsePubMedXml("<html>error</html>", ["39279639"]).size).toBe(0);
    expect(parsePubMedXml(null, ["39279639"]).size).toBe(0);
    expect(parsePubMedXml(SAMPLE_XML, ["javascript:alert(1)"]).size).toBe(0);
    expect(parsePubMedXml(SAMPLE_XML + "z".repeat(800000), ["39279639"]).size).toBe(0);
  });

  it("uses one bounded official NIH call for multiple links without visitor queries", async () => {
    const fetchStub = vi.fn(async (raw: string, opts: { next?: { revalidate: number }; headers?: Record<string, string> }) => {
      const url = new URL(raw);
      expect(url.origin).toBe("https://eutils.ncbi.nlm.nih.gov");
      expect(url.pathname).toBe("/entrez/eutils/efetch.fcgi");
      expect(url.searchParams.get("db")).toBe("pubmed");
      expect(url.searchParams.get("retmode")).toBe("xml");
      expect(url.searchParams.get("id")).toBe("39279639,37364590,34798060");
      expect([...url.searchParams.keys()].sort()).toEqual(["db", "id", "retmode"]);
      expect(opts.next?.revalidate).toBe(21600);
      expect(opts.headers?.accept).toBe("application/xml");
      return new Response(SAMPLE_XML);
    });
    vi.stubGlobal("fetch", fetchStub);
    const refs: TrialRegistryReference[] = [
      { pmid: "39279639", role: "RESULT", citation: "Registry QTc publication" },
      { pmid: "37364590", role: "BACKGROUND", citation: "Registry BACKGROUND" },
      { pmid: "34798060", role: "RESULT", citation: "No independently indexed NCT" },
    ];
    const checked = await crossCheckRegistryPublications([
      { nctId: "NCT05804162", reference: refs[0] },
      { nctId: "NCT04982575", reference: refs[1] },
      { nctId: "NCT03856047", reference: refs[2] },
      { nctId: "NCT05804162", reference: refs[0] },
      { nctId: "BAD", reference: refs[0] },
    ]);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(checked).toHaveLength(3);
    expect(checked.map(check => check.secondaryIdMatch)).toEqual([
      "confirmed", "confirmed", "not-corroborated",
    ]);
    expect(checked[1].reference.role).toBe("BACKGROUND");
    expect(checked[0].article?.title).toBe("Cagrilintide QTc & source review");
    expect(checked[2].article?.title).toBe("Only citation without NCT indexing");
  });

  it("provider failures preserve registry references but leave crosschecks unknown", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("NIH unavailable"); }));
    const checked = await crossCheckRegistryPublications([
      { nctId: "NCT05804162", reference: { pmid: "39279639", role: "RESULT", citation: "Original citation" } },
    ]);
    expect(checked).toEqual([{
      nctId: "NCT05804162",
      reference: { pmid: "39279639", role: "RESULT", citation: "Original citation" },
      article: null,
      secondaryIdMatch: "unavailable",
    }]);
  });

  it("never calls NIH without valid pinned identifiers", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    expect(await crossCheckRegistryPublications([])).toEqual([]);
    expect(await crossCheckRegistryPublications([
      { nctId: "invalid", reference: { pmid: "39279639", role: "RESULT", citation: null } },
    ])).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("caps source requests at twelve exact pairs with one fetch", async () => {
    const spy = vi.fn(async () => new Response(SAMPLE_XML));
    vi.stubGlobal("fetch", spy);
    const input = Array.from({ length: 50 }, (_, index) => ({
      nctId: "NCT00000001",
      reference: { pmid: String(12345000 + index), role: "BACKGROUND" as const, citation: null },
    }));
    const refs = await crossCheckRegistryPublications(input);
    expect(refs).toHaveLength(12);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

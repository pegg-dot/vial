import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeNctId } from "@/lib/nct-identifier";
import { lookupStudy, studySourceBrief, summarizeStudyEvidence } from "@/server/intelligence/study-lookup";
import type { PublicRegistryStudy } from "@/server/intelligence/cagrilintide-study-audit";

function trialRecord(id = "NCT05804162", pmid = "39279639", hasResults = false) {
  return {
    hasResults,
    ...(hasResults ? { resultsSection: { participantFlowModule: { preAssignmentDetails: "Data" } } } : {}),
    protocolSection: {
      identificationModule: { nctId: id, briefTitle: "Registry data for another compound" },
      statusModule: { overallStatus: "COMPLETED", lastUpdatePostDateStruct: { date: "2026-05-10", type: "ACTUAL" } },
      sponsorCollaboratorsModule: { leadSponsor: { name: "University Research Sponsor" } },
      designModule: { phases: ["PHASE2"], enrollmentInfo: { count: 120, type: "ACTUAL" } },
      armsInterventionsModule: { interventions: [{ type: "DRUG", name: "Test compound" }], armGroups: [{ label: "Study arm" }] },
      conditionsModule: { conditions: ["Study condition"] },
      eligibilityModule: { sex: "ALL", minimumAge: "18 Years", maximumAge: "65 Years", healthyVolunteers: false },
      outcomesModule: { primaryOutcomes: [{ measure: "Registered laboratory endpoint", timeFrame: "8 weeks" }] },
      referencesModule: { references: pmid ? [{ pmid, type: "RESULT", citation: "Official registry paper" }] : [] },
    },
  };
}

const xml = [
  '<?xml version="1.0"?><PubmedArticleSet><PubmedArticle><MedlineCitation>',
  '<PMID>39279639</PMID><Article><ArticleTitle>Published trial source</ArticleTitle>',
  '<Journal><ISOAbbreviation>Journal A</ISOAbbreviation><JournalIssue><PubDate><Year>2025</Year></PubDate></JournalIssue></Journal>',
  '<DataBankList><DataBank><DataBankName>ClinicalTrials.gov</DataBankName>',
  '<AccessionNumberList><AccessionNumber>NCT05804162</AccessionNumber></AccessionNumberList>',
  '</DataBank></DataBankList></Article></MedlineCitation></PubmedArticle></PubmedArticleSet>',
].join("");

afterEach(() => vi.unstubAllGlobals());

describe("public NCT identifiers", () => {
  it("accepts exact NCT IDs and official registry URL forms", () => {
    expect(normalizeNctId(" nct05804162 ")).toBe("NCT05804162");
    expect(normalizeNctId("https://clinicaltrials.gov/study/NCT05804162")).toBe("NCT05804162");
    expect(normalizeNctId("https://clinicaltrials.gov/study/nct05804162/")).toBe("NCT05804162");
    expect(normalizeNctId("https://clinicaltrials.gov/study/NCT05804162?format=json")).toBe("NCT05804162");
  });
  it.each([
    "NCT123", "NCT000000000", "NCT1234567x", "retatrutide",
    "https://clinicaltrials.gov.evil.example/study/NCT05804162",
    "http://clinicaltrials.gov/study/NCT05804162",
    "https://clinicaltrials.gov@evil.example/study/NCT05804162",
    "https://clinicaltrials.gov/study/NCT05804162/more",
    "https://clinicaltrials.gov/study/NCT05804162#x",
    "https://clinicaltrials.gov:333/study/NCT05804162",
    "A".repeat(300),
  ])("rejects unsafe or invalid input %s", input => {
    expect(normalizeNctId(input)).toBeNull();
  });
});

describe("one-study source reconciliation", () => {
  it("never sends an unvalidated input to official services", async () => {
    const stub = vi.fn();
    vi.stubGlobal("fetch", stub);
    expect(await lookupStudy("bad.example")).toMatchObject({ state: "invalid", nctId: null });
    expect(stub).not.toHaveBeenCalled();
  });
  it("distinguishes a true provider 404 from network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Missing", { status: 404 })));
    expect(await lookupStudy("NCT00000000")).toMatchObject({ state: "not-found" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Offline"); }));
    expect(await lookupStudy("NCT00000000")).toMatchObject({ state: "unavailable" });
  });
  it("checks exact NCT IDs with a bounded registry request and one PubMed request", async () => {
    const paths: string[] = [];
    const stub = vi.fn(async (raw: string, options: { next?: { revalidate?: number } }) => {
      const url = new URL(raw);
      paths.push(url.toString());
      expect(options.next?.revalidate).toBe(21_600);
      if (url.hostname === "clinicaltrials.gov") {
        expect(url.pathname).toBe("/api/v2/studies/NCT05804162");
        return Response.json(trialRecord());
      }
      expect(url.hostname).toBe("eutils.ncbi.nlm.nih.gov");
      expect(url.searchParams.get("id")).toBe("39279639");
      return new Response(xml);
    });
    vi.stubGlobal("fetch", stub);
    const result = await lookupStudy("nct05804162");
    expect(stub).toHaveBeenCalledTimes(2);
    expect(paths.every(path => !path.includes("personal-query"))).toBe(true);
    expect(result.state).toBe("available");
    if (result.state !== "available") return;
    expect(result.study.interventions).toEqual(["Test compound"]);
    expect(Object.keys(result.study)).not.toContain("matchLocation");
    expect(result.study.pubmedChecks[0].secondaryIdMatch).toBe("confirmed");
    expect(summarizeStudyEvidence(result.study).headline).toContain("registry cites a paper labeled RESULT");
    expect(studySourceBrief(result)).toContain("https://clinicaltrials.gov/study/NCT05804162");
    expect(studySourceBrief(result)).toContain("https://pubmed.ncbi.nlm.nih.gov/39279639/");
  });
  it("preserves registry citations and reports uncertainty when PubMed is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async (raw: string) => raw.includes("clinicaltrials.gov")
      ? Response.json(trialRecord())
      : new Response("Offline", { status: 503 })));
    const result = await lookupStudy("NCT05804162");
    expect(result.state).toBe("available");
    if (result.state !== "available") return;
    expect(result.study.registryReferences).toHaveLength(1);
    expect(result.study.pubmedChecks[0].secondaryIdMatch).toBe("unavailable");
    expect(summarizeStudyEvidence(result.study).headline).toContain("could not be confirmed");
  });
  it("does not claim missing publications when registry has no cited PMIDs", async () => {
    const stub = vi.fn(async () => Response.json(trialRecord("NCT00000001", "", true)));
    vi.stubGlobal("fetch", stub);
    const result = await lookupStudy("NCT00000001");
    expect(result.state).toBe("available");
    if (result.state !== "available") return;
    expect(result.study.registryReferences).toEqual([]);
    expect(stub).toHaveBeenCalledTimes(1);
    expect(summarizeStudyEvidence(result.study).detail).toContain("Papers may exist elsewhere");
  });
  it("fails closed when the returned NCT differs from the requested record", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(trialRecord("NCT12345678"))));
    expect(await lookupStudy("NCT05804162")).toMatchObject({ state: "unavailable" });
  });
  it("never claims BACKGROUND papers report trial results", () => {
    const study = {
      registryReferences: [{ pmid: "39279639", role: "BACKGROUND", citation: "Prior source" }],
      pubmedChecks: [{
        nctId: "NCT05804162",
        reference: { pmid: "39279639", role: "BACKGROUND", citation: "Prior source" },
        secondaryIdMatch: "confirmed",
        article: { pmid: "39279639", title: "Prior source", journal: null, publicationDate: null, url: "https://pubmed.ncbi.nlm.nih.gov/39279639/" },
      }],
      registryResults: "not-shown",
    } as PublicRegistryStudy;
    expect(summarizeStudyEvidence(study).headline).toContain("PubMed indexes");
    expect(summarizeStudyEvidence(study).detail).toContain("background context");
  });
});

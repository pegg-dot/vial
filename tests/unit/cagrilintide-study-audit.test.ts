import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CAGRILINTIDE_AUDIT_SELECTION,
  cagrilintideAuditMarkdown,
  getAuditCounts,
  getCagrilintideAudit,
  getCagrilintideAuditInsights,
  parseCagrilintideStudy,
} from "@/server/intelligence/cagrilintide-study-audit";

function syntheticRecord(nctId: string, opts?: {
  intervention?: string; title?: string; results?: boolean; status?: string; enrollment?: number; measure?: string;
  references?: Array<{ pmid: string; type: string; citation: string }>;
  healthyVolunteers?: boolean; conditions?: string[];
}) {
  return {
    hasResults: opts?.results ?? true,
    resultsSection: (opts?.results ?? true) ? { participantFlowModule: { groups: [] } } : undefined,
    protocolSection: {
      identificationModule: {
        nctId,
        briefTitle: opts?.title ?? "Synthetic public registry contract example",
      },
      statusModule: {
        overallStatus: opts?.status ?? "COMPLETED",
        primaryCompletionDateStruct: { date: "2028-02-23", type: "ESTIMATED" },
        lastUpdatePostDateStruct: { date: "2026-09-30", type: "ACTUAL" },
      },
      designModule: {
        phases: ["PHASE2"], enrollmentInfo: { count: opts?.enrollment ?? 92, type: "ACTUAL" },
      },
      sponsorCollaboratorsModule: { leadSponsor: { name: "Example research sponsor" } },
      eligibilityModule: {
        sex: "ALL", minimumAge: "18 Years", maximumAge: "55 Years",
        healthyVolunteers: opts?.healthyVolunteers,
      },
      conditionsModule: { conditions: opts?.conditions ?? ["Overweight"] },
      armsInterventionsModule: {
        interventions: [
          { type: "DRUG", name: opts?.intervention ?? "Cagrilintide", otherNames: !opts?.intervention || opts.intervention === "Cagrilintide" ? ["NNC0174-0833"] : [] },
        ],
        armGroups: [{ label: "Registered Arm 1" }, { label: "Registered Arm 2" }],
      },
      referencesModule: { references: opts?.references ?? [] },
      outcomesModule: {
        primaryOutcomes: [
          { measure: opts?.measure ?? "Synthetic outcome 1", timeFrame: "Baseline, Week 32" },
          { measure: "Synthetic outcome 2", timeFrame: "Week 40" },
        ],
      },
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("single-task cagrilintide study audit prototype", () => {
  it("scopes to four official NCT IDs and separately names the combination program", () => {
    expect(CAGRILINTIDE_AUDIT_SELECTION.map(row => row.nctId)).toEqual([
      "NCT03856047", "NCT04982575", "NCT05804162", "NCT07564414",
    ]);
    expect(CAGRILINTIDE_AUDIT_SELECTION.map(row => row.scope)).toEqual([
      "direct-name", "direct-name", "direct-name", "combination-name",
    ]);
  });

  it("parses study design and preserves projected vs actual dates without clinical inference", () => {
    const record = syntheticRecord("NCT03856047");
    const study = parseCagrilintideStudy(record, "NCT03856047");
    expect(study).not.toBeNull();
    expect(study?.matchLocation).toBe("intervention-recorded");
    expect(study?.enrollment).toEqual({ count: 92, precision: "ACTUAL" });
    expect(study?.primaryCompletion).toEqual({ date: "2028-02-23", precision: "ESTIMATED" });
    expect(study?.lastRegistryUpdate).toBe("2026-09-30");
    expect(study?.registryResults).toBe("present");
    expect(study?.primaryOutcomeCount).toBe(2);
    expect(study?.primaryOutcomes[0].timeFrame).toBe("Baseline, Week 32");
    expect(study?.sponsor).toBe("Example research sponsor");
    expect(study?.population).toEqual({
      conditions: ["Overweight"], sex: "ALL", minimumAge: "18 Years",
      maximumAge: "55 Years", healthyVolunteers: null,
      armLabels: ["Registered Arm 1", "Registered Arm 2"],
    });
  });

  it("keeps missing registry results distinct from missing outcomes, and flags contradictory sections", () => {
    const noResults = parseCagrilintideStudy(syntheticRecord("NCT05804162", {
      results: false, intervention: "Cagrilintide",
    }), "NCT05804162");
    expect(noResults?.registryResults).toBe("not-shown");
    expect(noResults?.primaryOutcomeCount).toBe(2);
    const ambiguous = syntheticRecord("NCT05804162", { results: true });
    ambiguous.hasResults = false;
    expect(parseCagrilintideStudy(ambiguous, "NCT05804162")?.registryResults).toBe("uncertain");
  });

  it("does not map CagriSema-only intervention naming to a direct molecule intervention", () => {
    const study = parseCagrilintideStudy(syntheticRecord("NCT07564414", {
      intervention: "CagriSema",
      title: "CagriSema research study",
      results: false,
    }), "NCT07564414");
    expect(study?.matchLocation).toBe("search-hit-only");
  });

  it("rejects mismatched or malformed identifiers and invalid dates", () => {
    expect(parseCagrilintideStudy(syntheticRecord("NCT03856047"), "NCT99999999")).toBeNull();
    expect(parseCagrilintideStudy(null, "NCT03856047")).toBeNull();
    expect(parseCagrilintideStudy(syntheticRecord("NCT03856047"), "javascript:alert(1)")).toBeNull();
    const broken = syntheticRecord("NCT03856047");
    broken.protocolSection.statusModule.primaryCompletionDateStruct.date = "2026-02-31";
    expect(parseCagrilintideStudy(broken, "NCT03856047")?.primaryCompletion).toBeNull();
  });

  it("fetches exactly four static official records, tolerates partial failure and exports factual source links", async () => {
    const fetchSpy = vi.fn(async (url: string, init: { next: { revalidate: number } }) => {
      expect(url).toMatch(/^https:\/\/clinicaltrials\.gov\/api\/v2\/studies\/NCT\d{8}$/);
      expect(init.next.revalidate).toBe(21_600);
      const nctId = url.split("/").at(-1)!;
      if (nctId === "NCT05804162") return new Response("No source", { status: 503 });
      return Response.json(syntheticRecord(nctId, {
        intervention: nctId === "NCT07564414" ? "CagriSema" : "Cagrilintide",
        results: nctId !== "NCT07564414",
      }));
    });
    vi.stubGlobal("fetch", fetchSpy);
    const audit = await getCagrilintideAudit();
    expect(fetchSpy).toHaveBeenCalledTimes(4);
    expect(fetchSpy.mock.calls.map(call => call[0])).toEqual(CAGRILINTIDE_AUDIT_SELECTION.map(
      item => "https://clinicaltrials.gov/api/v2/studies/" + item.nctId,
    ));
    const counts = getAuditCounts(audit);
    expect(counts).toMatchObject({
      selected: 4, available: 3, unavailable: 1,
      directNamed: 2, directWithResultsSection: 2,
      directWithoutResultsSection: 0, combinationNameOnly: 1,
    });
    const exportText = cagrilintideAuditMarkdown(audit);
    expect(exportText).toContain("https://clinicaltrials.gov/study/NCT03856047");
    expect(exportText).toContain("NCT05804162");
    expect(exportText).toContain("Source unavailable or unparseable");
    expect(exportText).toContain("NOT a complete program search");
    expect(exportText).toContain("No earlier version baseline");
    expect(exportText).not.toContain("approved treatment");
  });

  it("generates factual reviewer prompts with original links, not clinical conclusions", async () => {
    const sample = vi.fn(async (url: string) => {
      const id = url.split("/").at(-1)!;
      return Response.json(syntheticRecord(id, {
        intervention: id === "NCT07564414" ? "CagriSema" : "Cagrilintide",
        results: id !== "NCT05804162" && id !== "NCT07564414",
        status: id === "NCT07564414" ? "RECRUITING" : "COMPLETED",
        measure: id === "NCT04982575" ? "HbA1c" : id === "NCT05804162" ? "QTcF" : "Body weight",
      }));
    });
    vi.stubGlobal("fetch", sample);
    const audit = await getCagrilintideAudit();
    const insights = getCagrilintideAuditInsights(audit);
    expect(insights.map(x => x.heading)).toEqual([
      "Ingredient identity differs from the registry intervention label",
      "Completed studies needing a results-source check",
      "Different primary outcome measures are being compared",
      "A dated study milestone is still an estimate",
    ]);
    expect(insights[0].sources).toContainEqual(expect.objectContaining({
      url: "https://www.novonordisk.com/news-and-media/news-and-ir-materials/news-details.html?id=916501",
    }));
    expect(insights[1].sources.map(x => x.title)).toEqual(["NCT05804162"]);
    expect(insights[3].observation).toContain("2028-02-23");
    expect(insights.every(x => x.sources.every(z => z.url.startsWith("https://")))).toBe(true);
    const auditExport = cagrilintideAuditMarkdown(audit);
    expect(auditExport).toContain("## What this selected metadata flags for verification");
    expect(auditExport).toContain("Novo Nordisk sponsor statement");
  });

  it("reconciles absent registry results with an independently indexed PubMed RESULT citation", async () => {
    const calls: string[] = [];
    const mockFetch = vi.fn(async (raw: string) => {
      const url = new URL(raw);
      calls.push(url.hostname);
      if (url.hostname === "clinicaltrials.gov") {
        const nctId = url.pathname.split("/").at(-1)!;
        const roleAndPmid: Record<string, [string, string]> = {
          NCT03856047: ["RESULT", "34798060"],
          NCT04982575: ["BACKGROUND", "37364590"],
          NCT05804162: ["RESULT", "39279639"],
        };
        return Response.json(syntheticRecord(nctId, {
          intervention: nctId === "NCT07564414" ? "CagriSema" : "Cagrilintide",
          results: nctId !== "NCT05804162" && nctId !== "NCT07564414",
          status: nctId === "NCT07564414" ? "RECRUITING" : "COMPLETED",
          references: roleAndPmid[nctId] ? [{
            type: roleAndPmid[nctId][0], pmid: roleAndPmid[nctId][1], citation: "Official registry citation for " + nctId,
          }] : [],
        }));
      }
      expect(url.hostname).toBe("eutils.ncbi.nlm.nih.gov");
      expect(url.pathname).toBe("/entrez/eutils/efetch.fcgi");
      return new Response([
        "<PubmedArticleSet>",
        ...Object.entries({
          NCT03856047: "34798060", NCT04982575: "37364590", NCT05804162: "39279639",
        }).map(([nct, pmid]) => [
          "<PubmedArticle><MedlineCitation><PMID>", pmid, "</PMID><Article>",
          "<ArticleTitle>Paper for ", nct, "</ArticleTitle>",
          "<DataBankList><DataBank><DataBankName>ClinicalTrials.gov</DataBankName><AccessionNumberList>",
          "<AccessionNumber>", nct, "</AccessionNumber>",
          "</AccessionNumberList></DataBank></DataBankList>",
          "</Article></MedlineCitation></PubmedArticle>",
        ].join("")),
        "</PubmedArticleSet>",
      ].join(""));
    });
    vi.stubGlobal("fetch", mockFetch);
    const audit = await getCagrilintideAudit();
    expect(mockFetch).toHaveBeenCalledTimes(5);
    expect(calls.filter(h => h === "clinicaltrials.gov")).toHaveLength(4);
    expect(calls.filter(h => h === "eutils.ncbi.nlm.nih.gov")).toHaveLength(1);
    expect(getAuditCounts(audit)).toMatchObject({
      directWithResultsSection: 2,
      directWithoutResultsSection: 1,
      directResultPapersCorroborated: 2,
      withoutRegistryResultsButWithResultPaper: 1,
    });
    const insights = getCagrilintideAuditInsights(audit);
    expect(insights[0].heading).toBe("A results publication exists outside the registry results section");
    expect(insights[0].sources).toEqual([
      { title: "ClinicalTrials.gov NCT05804162", url: "https://clinicaltrials.gov/study/NCT05804162" },
      { title: "PubMed 39279639", url: "https://pubmed.ncbi.nlm.nih.gov/39279639/" },
    ]);
    expect(insights.some(i => i.heading === "A registry BACKGROUND citation is linked to the same study in PubMed")).toBe(true);
    expect(insights.some(i => i.heading === "Completed studies needing a results-source check")).toBe(false);
    const exported = cagrilintideAuditMarkdown(audit);
    expect(exported).toContain("Registry reference label: RESULT | Exact NCT-to-PMID crosscheck: confirmed");
    expect(exported).toContain("Registry reference label: BACKGROUND | Exact NCT-to-PMID crosscheck: confirmed");
    expect(exported).toContain("https://pubmed.ncbi.nlm.nih.gov/39279639/");
    expect(exported).toContain("A results publication exists outside the registry results section");
    expect(exported).not.toContain("clinically effective treatment");
  });

  it("shows factual eligibility differences without claiming different populations have equal outcomes", async () => {
    const stub = vi.fn(async (raw: string) => {
      const nctId = raw.split("/").at(-1)!;
      return Response.json(syntheticRecord(nctId, {
        intervention: nctId === "NCT07564414" ? "CagriSema" : "Cagrilintide",
        healthyVolunteers: nctId === "NCT05804162",
        conditions: nctId === "NCT05804162" ? ["Obesity"] : ["Diabetes Mellitus, Type 2"],
      }));
    });
    vi.stubGlobal("fetch", stub);
    const audit = await getCagrilintideAudit();
    const insights = getCagrilintideAuditInsights(audit);
    const difference = insights.find(item => item.heading === "The selected trials register different participant eligibility");
    expect(difference?.observation).toContain("NCT05804162 permits healthy volunteers");
    expect(difference?.interpretationLimit).toContain("not verified descriptions");
    expect(difference?.sources.map(row => row.title)).toEqual(["NCT05804162", "NCT03856047", "NCT04982575"]);
    expect(cagrilintideAuditMarkdown(audit)).toContain("Healthy volunteers accepted: true");
    expect(cagrilintideAuditMarkdown(audit)).toContain("Registered arm labels: Registered Arm 1; Registered Arm 2");
  });

  it("marks source verification unknown rather than zero when PubMed is unavailable", async () => {
    const stub = vi.fn(async (raw: string) => {
      if (raw.includes("eutils.ncbi.nlm.nih.gov")) return new Response("source unavailable", { status: 503 });
      const id = raw.split("/").at(-1)!;
      return Response.json(syntheticRecord(id, {
        intervention: id === "NCT07564414" ? "CagriSema" : "Cagrilintide",
        results: id !== "NCT05804162" && id !== "NCT07564414",
        references: id === "NCT05804162" ? [{ pmid: "39279639", type: "RESULT", citation: "Original NLM citation" }] : [],
      }));
    });
    vi.stubGlobal("fetch", stub);
    const audit = await getCagrilintideAudit();
    expect(getAuditCounts(audit)).toMatchObject({
      withoutRegistryResultsButWithResultPaper: 0,
      missingRegistryResultsWithUnverifiedPaper: 1,
    });
    expect(cagrilintideAuditMarkdown(audit)).toContain("PMID 39279639 | Registry reference label: RESULT | Exact NCT-to-PMID crosscheck: unavailable");
    expect(getCagrilintideAuditInsights(audit).some(insight => insight.heading === "A results publication exists outside the registry results section")).toBe(false);
  });

  it("flags a changed direct-name relationship for manual review rather than counting it as verified", async () => {
    const fetchSpy = vi.fn(async (url: string) => {
      const id = url.split("/").at(-1)!;
      return Response.json(syntheticRecord(id, {
        intervention: id === "NCT03856047" ? "Unrelated product" : id === "NCT07564414" ? "CagriSema" : "Cagrilintide",
        results: false,
      }));
    });
    vi.stubGlobal("fetch", fetchSpy);
    const report = await getCagrilintideAudit();
    expect(getAuditCounts(report).directNameUnconfirmed).toBe(1);
    expect(getAuditCounts(report).directWithoutResultsSection).toBe(2);
  });
});

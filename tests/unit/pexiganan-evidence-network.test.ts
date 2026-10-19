import { describe, expect, it } from "vitest";
import {
  PEXIGANAN_CLAIMS, PEXIGANAN_RECORDED_ORGANIZATIONS,
  PEXIGANAN_SOURCES, PEXIGANAN_TRIAL_SELECTION,
  pexEvidencePassportMarkdown, pexSourceByIdentifier, pexSourceById,
} from "@/lib/pexiganan-evidence-network";
import { isPexigananNamedIntervention } from "@/server/intelligence/pexiganan-network";

describe("Pexiganan scientific source network", () => {
  it("binds six scoped claims to ten unique original records with traceable scientific limitations", () => {
    expect(PEXIGANAN_CLAIMS).toHaveLength(6);
    expect(PEXIGANAN_SOURCES).toHaveLength(10);
    expect(PEXIGANAN_TRIAL_SELECTION).toHaveLength(4);
    expect(new Set(PEXIGANAN_SOURCES.map(s => s.id)).size).toBe(10);
    expect(new Set(PEXIGANAN_SOURCES.map(s => s.identifier)).size).toBe(10);
    for (const claim of PEXIGANAN_CLAIMS) {
      expect(claim.finding.length).toBeGreaterThan(65);
      expect(claim.whatItDoesNotShow.length).toBeGreaterThan(45);
      expect(claim.reviewTask.length).toBeGreaterThan(60);
      expect(claim.sourceIds.length).toBeGreaterThan(0);
      for (const id of claim.sourceIds) expect(pexSourceById(id), id).toBeDefined();
    }
    for (const record of PEXIGANAN_SOURCES) {
      const u = new URL(record.url);
      expect(u.protocol).toBe("https:");
      expect(["pubchem.ncbi.nlm.nih.gov", "clinicaltrials.gov", "pubmed.ncbi.nlm.nih.gov"]).toContain(u.hostname);
      expect(record.limitation.length).toBeGreaterThan(60);
    }
  });

  it("separates molecule identities, publication TYPES and exact trial identity", () => {
    expect(pexSourceByIdentifier("CID 16132253")?.id).toBe("pubchem-pexiganan");
    expect(pexSourceByIdentifier("CID 16130189")?.id).toBe("pubchem-magainin");
    expect(pexSourceByIdentifier("PMID 12719236")?.kind).toBe("original-experiment");
    expect(pexSourceByIdentifier("PMID 19010301")?.kind).toBe("secondary-review");
    expect(pexSourceByIdentifier("PMID 18990064")?.kind).toBe("clinical-paper");
    expect(pexSourceByIdentifier("PMID 36781451")?.kind).toBe("secondary-review");
    expect(PEXIGANAN_CLAIMS.find(c => c.id === "publication-ambiguity")?.status).toBe("needs-interpretation");
    expect(PEXIGANAN_CLAIMS.find(c => c.id === "review-misreading")?.status).toBe("cross-source-checked");
    expect(PEXIGANAN_CLAIMS.find(c => c.id === "review-misreading")?.whatItDoesNotShow).toContain("DERIVED");
  });

  it("looks up ONLY exact allowlisted scientific identifiers without accepting URLs or arbitrary documents", () => {
    expect(pexSourceByIdentifier("NCT01594762")?.id).toBe("onestep-2");
    expect(pexSourceByIdentifier(" nct00563394 ")?.id).toBe("msi-78-study-a");
    expect(pexSourceByIdentifier("pmid 36781451")?.id).toBe("later-review");
    expect(pexSourceByIdentifier("18990064")?.id).toBe("trial-rct-article");
    for (const query of [
      "NCT99999999", "PMID 12345", "CID 8888888", "MSI-78",
      "https://pubmed.ncbi.nlm.nih.gov/12719236/", "NCT01594762' OR 1=1",
      "NCT015947620", "NCT0056339", "mymarketplace.com", " NCT01594762\\nREVIEW",
      "x".repeat(140),
    ]) expect(pexSourceByIdentifier(query), query).toBeNull();
  });

  it("guards direct intervention aliases against partial matches and unrelated compounds", () => {
    for (const value of ["Topical pexiganan cream 0.8%", "MSI-78", "MSI-78 topical cream", "Pexiganan"]) {
      expect(isPexigananNamedIntervention(value), value).toBe(true);
    }
    for (const value of ["MSI-780", "MSI-78analog", "notpexiganan", "ofloxacin", "Placebo", "Magainin 2"]) {
      expect(isPexigananNamedIntervention(value), value).toBe(false);
    }
  });

  it("attributes recorded sponsors without implying current ownership or testing-lab accreditation", () => {
    expect(PEXIGANAN_RECORDED_ORGANIZATIONS.map(o => o.name)).toEqual([
      "Dipexium Pharmaceuticals, Inc.", "Abeona Therapeutics, Inc",
    ]);
    expect(PEXIGANAN_TRIAL_SELECTION.map(t => t.nctId)).toEqual([
      "NCT01594762", "NCT01590758", "NCT00563394", "NCT00563433",
    ]);
    const allNct = PEXIGANAN_RECORDED_ORGANIZATIONS.flatMap(org => [...org.nctIds]);
    expect(new Set(allNct)).toEqual(new Set(PEXIGANAN_TRIAL_SELECTION.map(s => s.nctId)));
  });

  it("exports source links, uncertainty, review tasks and no commerce or clinical verdict", () => {
    const markdown = pexEvidencePassportMarkdown();
    expect(markdown).toContain("PMID 36781451");
    expect(markdown).toContain("PMID 18990064");
    expect(markdown).toContain("https://clinicaltrials.gov/study/NCT00563394");
    expect(markdown).toContain("https://pubchem.ncbi.nlm.nih.gov/compound/16132253");
    expect(markdown).toContain("Editorial review is provisional");
    expect(markdown).toContain("No batch, COA, testing laboratory, vendor, procurement availability");
    expect(markdown).not.toMatch(/Add to cart|Buy now|Clinical winner|Approved to buy/i);
  });
});

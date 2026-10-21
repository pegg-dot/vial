import { describe, expect, it } from "vitest";
import { RESEARCH_SUBJECTS, researchSubjectBySlug } from "@/lib/research-explorer";
import { ORGANIZATIONS_LIMITATION, organizationsForSubject, type OrganizationsView } from "@/lib/research-organizations";
import { PEXIGANAN_RECORDED_ORGANIZATIONS, PEXIGANAN_TRIAL_SELECTION } from "@/lib/pexiganan-evidence-network";
import type { PublicRegistryStudy } from "@/server/intelligence/cagrilintide-study-audit";
import type { StudyLookup } from "@/server/intelligence/study-lookup";

const cagri = researchSubjectBySlug("cagrilintide")!;
const BANNED = ["buy", "shop", "price", "cart", "order", "available from", "in stock", "discount", "supplier", "vendor", "purchase", "manufacturer"];

function study(overrides: Partial<PublicRegistryStudy> = {}): PublicRegistryStudy {
  return {
    nctId: "NCT05804162", title: "A Research Study Looking at How Cagrilintide Works",
    url: "https://clinicaltrials.gov/study/NCT05804162", sponsor: "Novo Nordisk A/S", phase: "PHASE1", status: "COMPLETED",
    enrollment: null, primaryCompletion: null, lastRegistryUpdate: "2024-11-01",
    interventions: ["Cagrilintide"], primaryOutcomes: [], primaryOutcomeCount: 0,
    population: { conditions: [], sex: "ALL", minimumAge: null, maximumAge: null, healthyVolunteers: true, armLabels: [] },
    registryResults: "not-shown", registryReferences: [], pubmedChecks: [],
    ...overrides,
  } as PublicRegistryStudy;
}
const available = (s: PublicRegistryStudy = study()): StudyLookup => ({ state: "available", nctId: s.nctId, checkedAt: "2026-10-21T10:00:00Z", study: s });

function textOf(view: OrganizationsView): string {
  return JSON.stringify(view).toLowerCase() + ORGANIZATIONS_LIMITATION.toLowerCase();
}

describe("organizations on record (Sources A1)", () => {
  it("lists one row per organization per study for pexiganan, each with its own registry link", () => {
    const view = organizationsForSubject(researchSubjectBySlug("pexiganan")!, null);
    expect(view.unconfirmed).toBeNull();
    expect(view.rows).toHaveLength(4);
    expect(new Set(view.rows.map(r => r.key)).size).toBe(4);
    expect(view.rows.map(r => r.studyId).sort()).toEqual(PEXIGANAN_TRIAL_SELECTION.map(t => t.nctId).sort());
    for (const row of view.rows) {
      expect(row.sourceUrl).toBe("https://clinicaltrials.gov/study/" + row.studyId);
      const org = PEXIGANAN_RECORDED_ORGANIZATIONS.find(o => o.name === row.organization)!;
      expect(org.nctIds as readonly string[]).toContain(row.studyId);
      expect(row.basis).toMatch(/reviewed 2026-\d\d-\d\d/);
    }
  });

  it("shows the sponsor only when the dossier's identity guard verified the pinned study", () => {
    const view = organizationsForSubject(cagri, available());
    expect(view.rows).toHaveLength(1);
    expect(view.rows[0]).toMatchObject({ organization: "Novo Nordisk A/S", studyId: "NCT05804162", sourceUrl: "https://clinicaltrials.gov/study/NCT05804162" });
    expect(view.rows[0]!.basis).toBe("Registry record read 2026-10-21");
    expect(view.unconfirmed).toBeNull();
  });

  it("never shows a sponsor from a study that did not match the compound", () => {
    for (const lookup of [
      available(study({ interventions: ["Semaglutide"] })),
      available(study({ interventions: ["Pre-cagrilintideAnalog"] })),
      { ...available(), nctId: "NCT12345678" } as StudyLookup,
      { state: "unavailable", nctId: "NCT05804162", checkedAt: "2026-10-21T10:00:00Z" } as StudyLookup,
    ]) {
      const view = organizationsForSubject(cagri, lookup);
      expect(view.rows).toEqual([]);
      expect(view.unconfirmed).toMatchObject({ studyId: "NCT05804162", reason: "unverified", sourceUrl: "https://clinicaltrials.gov/study/NCT05804162" });
    }
  });

  it("says so when the registry names no sponsor, and when the record was not read", () => {
    expect(organizationsForSubject(cagri, available(study({ sponsor: null }))).unconfirmed?.reason).toBe("not-reported");
    expect(organizationsForSubject(cagri, available(study({ sponsor: null }))).rows).toEqual([]);
    expect(organizationsForSubject(cagri, null).unconfirmed?.reason).toBe("not-checked");
  });

  it("returns nothing, not a guess, for a subject with no pinned study", () => {
    const none = RESEARCH_SUBJECTS.find(s => !s.sampleTrial && s.slug !== "pexiganan")!;
    expect(organizationsForSubject(none, available())).toEqual({ rows: [], unconfirmed: null });
  });

  it("every row for every subject links to an official registry record", () => {
    for (const subject of RESEARCH_SUBJECTS) {
      for (const view of [organizationsForSubject(subject, null), organizationsForSubject(subject, subject.sampleTrial ? available(study({ nctId: subject.sampleTrial, interventions: [subject.name] })) : null)]) {
        for (const row of view.rows) {
          expect(row.sourceUrl).toMatch(/^https:\/\/clinicaltrials\.gov\/study\/NCT\d{8}$/);
          expect(row.organization.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("uses no selling, supply or availability wording, and says what a sponsor field is not", () => {
    const views = [organizationsForSubject(researchSubjectBySlug("pexiganan")!, null), organizationsForSubject(cagri, available()), organizationsForSubject(cagri, null)];
    for (const view of views) for (const word of BANNED) expect(textOf(view)).not.toContain(word);
    expect(ORGANIZATIONS_LIMITATION).toContain("does not establish who originated");
  });
});

/**
 * Read-only, bounded public ClinicalTrials.gov API projection for the
 * Pexiganan / MSI-78 evidence passport. Never loads marketplace records,
 * user history, laboratory certificates, purchases, or source full text.
 */
import { lookupStudy } from "@/server/intelligence/study-lookup";
import { PEXIGANAN_TRIAL_SELECTION, type PexTrialSelection } from "@/lib/pexiganan-evidence-network";

export type PexTrialEvidence =
  | {
    state: "matched";
    selected: PexTrialSelection;
    checkedAt: string;
    sourceUrl: string;
    title: string;
    matchedIntervention: string;
    status: string | null;
    phase: string | null;
    sponsor: string | null;
    registryResults: "present" | "not-shown" | "uncertain";
    lastRegistryUpdate: string | null;
    primaryOutcomes: readonly string[];
    citations: readonly {
      pmid: string;
      role: string;
      exactNctAssociation: "confirmed" | "not-corroborated" | "unavailable";
      pubmedTitle: string | null;
    }[];
  }
  | {
    state: "unavailable" | "identity-not-verified";
    selected: PexTrialSelection;
    checkedAt: string;
    sourceUrl: string;
  };

/** Match intervention-field names only, not title or search-result mentions.
 * MSI-78 is a known research name of pexiganan, not universal proof that
 * any vaguely similarly named formulation or batch is equivalent. */
export function isPexigananNamedIntervention(value: string): boolean {
  return /(?:^|[^a-z0-9])(?:pexiganan|msi-78)(?=$|[^a-z0-9])/i.test(value);
}

export async function getPexigananTrialEvidence(): Promise<PexTrialEvidence[]> {
  return Promise.all(PEXIGANAN_TRIAL_SELECTION.map(async selected => {
    const sourceUrl = "https://clinicaltrials.gov/study/" + selected.nctId;
    const lookup = await lookupStudy(selected.nctId);
    if (lookup.state !== "available") {
      return { state: "unavailable" as const, selected, checkedAt: lookup.checkedAt, sourceUrl };
    }
    const matchedIntervention = lookup.study.interventions.find(isPexigananNamedIntervention);
    if (!matchedIntervention || lookup.study.nctId !== selected.nctId) {
      return { state: "identity-not-verified" as const, selected, checkedAt: lookup.checkedAt, sourceUrl };
    }
    return {
      state: "matched" as const,
      selected,
      checkedAt: lookup.checkedAt,
      sourceUrl,
      title: lookup.study.title,
      matchedIntervention,
      status: lookup.study.status,
      phase: lookup.study.phase,
      sponsor: lookup.study.sponsor,
      registryResults: lookup.study.registryResults,
      lastRegistryUpdate: lookup.study.lastRegistryUpdate,
      primaryOutcomes: lookup.study.primaryOutcomes.map(row => row.measure),
      citations: lookup.study.pubmedChecks.map(row => ({
        pmid: row.reference.pmid,
        role: row.reference.role,
        exactNctAssociation: row.secondaryIdMatch,
        pubmedTitle: row.article?.title ?? null,
      })),
    };
  }));
}

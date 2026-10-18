/**
 * Candidate scientific identifiers, selectively recovered from the historical
 * marketplace taxonomy. No user searches, vendor data or protected documents.
 *
 * The entries below are source-anchored DISCOVERY LEADS, not a validated
 * clinical asset graph. New aliases are never imported automatically from
 * scripts/data/peptide-compounds.json and no production source fetch consumes
 * this list. Expert review is required before public evidence expansion.
 */
export type ResearchTopicKey = "retatrutide" | "cagrilintide" | "tirzepatide";

export type AliasCandidate = {
  value: string;
  role: "development-code";
  sourceUrl: string;
  sourceId: string;
};

export type ResearchIdentityCandidate = {
  key: ResearchTopicKey;
  canonicalName: string;
  aliases: readonly AliasCandidate[];
};

export const RESEARCH_IDENTITY_CANDIDATES: readonly ResearchIdentityCandidate[] = [
  {
    key: "retatrutide",
    canonicalName: "Retatrutide",
    aliases: [{
      value: "LY3437943",
      role: "development-code",
      sourceId: "NCT05929079",
      sourceUrl: "https://clinicaltrials.gov/study/NCT05929079",
    }],
  },
  {
    key: "cagrilintide",
    canonicalName: "Cagrilintide",
    aliases: [{
      value: "NNC0174-0833",
      role: "development-code",
      sourceId: "NCT02958085",
      sourceUrl: "https://clinicaltrials.gov/study/NCT02958085",
    }],
  },
  {
    key: "tirzepatide",
    canonicalName: "Tirzepatide",
    aliases: [{
      value: "LY3298176",
      role: "development-code",
      sourceId: "NCT02759107",
      sourceUrl: "https://clinicaltrials.gov/study/NCT02759107",
    }],
  },
];

export function getResearchIdentityCandidate(key: string): ResearchIdentityCandidate | null {
  return RESEARCH_IDENTITY_CANDIDATES.find(item => item.key === key) ?? null;
}

function termPresent(text: unknown, term: string): boolean {
  if (typeof text !== "string" || text.length > 20_000) return false;
  const parts = term.match(/[A-Za-z0-9]+/g) ?? [];
  if (!parts.length) return false;
  const pattern = "(^|[^A-Za-z0-9])" + parts.join("[^A-Za-z0-9]*") + "(?=$|[^A-Za-z0-9])";
  return new RegExp(pattern, "i").test(text);
}

type TrialIntervention = {
  name?: unknown;
  otherNames?: unknown;
};

export type TrialAssociation = "intervention-recorded" | "named-in-title" | "search-hit-only";

/**
 * 'intervention-recorded' means the registered record names the molecule/code
 * as an intervention, which can be an investigational arm OR a comparator.
 * 'named-in-title' is weaker; 'search-hit-only' is unconfirmed. NONE of these
 * categories means a study showed clinical efficacy, approval, or relevance
 * to every use of the compound. No clinical conclusions are generated.
 */
export function classifyTrialAssociation(
  registryRecord: unknown,
  identity: ResearchIdentityCandidate,
): TrialAssociation {
  if (!registryRecord || typeof registryRecord !== "object") return "search-hit-only";
  const protocol = (registryRecord as { protocolSection?: unknown }).protocolSection;
  if (!protocol || typeof protocol !== "object") return "search-hit-only";

  const section = protocol as {
    identificationModule?: { briefTitle?: unknown; officialTitle?: unknown };
    armsInterventionsModule?: { interventions?: unknown };
  };
  const terms = [identity.canonicalName, ...identity.aliases.map(alias => alias.value)];
  const rawInterventions = section.armsInterventionsModule?.interventions;
  const interventions: TrialIntervention[] = Array.isArray(rawInterventions)
    ? rawInterventions.filter((row): row is TrialIntervention => row !== null && typeof row === "object")
    : [];

  const isNamedIntervention = interventions.some(intervention => {
    const names = [
      intervention.name,
      ...(Array.isArray(intervention.otherNames) ? intervention.otherNames : []),
    ];
    return names.some(name => terms.some(term => termPresent(name, term)));
  });
  if (isNamedIntervention) return "intervention-recorded";

  const titles = [section.identificationModule?.briefTitle, section.identificationModule?.officialTitle];
  if (titles.some(title => terms.some(term => termPresent(title, term)))) return "named-in-title";
  return "search-hit-only";
}

/** Exact identifiers only. No brand, combination product, or slang expansion. */
export function getCandidateQueries(key: string): string[] {
  const identity = getResearchIdentityCandidate(key);
  return identity ? [identity.canonicalName, ...identity.aliases.map(alias => alias.value)] : [];
}

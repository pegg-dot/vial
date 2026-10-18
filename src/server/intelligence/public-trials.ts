/**
 * Deliberately narrow, read-only, public R&D data experiment.
 *
 * Search terms are hardcoded for all visitors; the service does not transmit
 * a visitor's saved compounds, medical interests, account, query or IP to NIH.
 * Registry entries are evidence of registration, not efficacy, safety, or approval.
 */
export const PUBLIC_RESEARCH_TOPICS = [
  { key: "retatrutide", label: "Retatrutide" },
  { key: "cagrilintide", label: "Cagrilintide" },
  { key: "tirzepatide", label: "Tirzepatide" },
] as const;

export type RegistryTrial = {
  nctId: string;
  title: string;
  status: string;
  phase: string | null;
  sponsor: string | null;
  lastUpdated: string | null;
  resultsReported: boolean;
};
export type TopicTrials = {
  key: string;
  label: string;
  studies: RegistryTrial[];
  checkedAt: string;
  unavailable: boolean;
};

type TrialLike = {
  protocolSection?: {
    identificationModule?: { nctId?: unknown; briefTitle?: unknown };
    statusModule?: { overallStatus?: unknown; lastUpdatePostDateStruct?: { date?: unknown } };
    designModule?: { phases?: unknown };
    sponsorCollaboratorsModule?: { leadSponsor?: { name?: unknown } };
  };
  hasResults?: unknown;
};

function shortString(input: unknown, cap: number): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  return trimmed ? trimmed.slice(0, cap) : null;
}

export function parseTrialRegistryResponse(input: unknown): RegistryTrial[] {
  if (!input || typeof input !== "object" || !("studies" in input)) return [];
  const raw = (input as { studies: unknown }).studies;
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 12).flatMap((item): RegistryTrial[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as TrialLike;
    const section = row.protocolSection;
    const nctId = shortString(section?.identificationModule?.nctId, 16);
    const title = shortString(section?.identificationModule?.briefTitle, 260);
    if (!nctId || !/^NCT\d{8}$/.test(nctId) || !title) return [];
    const phases = section?.designModule?.phases;
    return [{
      nctId,
      title,
      status: shortString(section?.statusModule?.overallStatus, 40) ?? "NOT REPORTED",
      phase: Array.isArray(phases)
        ? phases.filter((x): x is string => typeof x === "string").slice(0, 2).join(", ") || null
        : null,
      sponsor: shortString(section?.sponsorCollaboratorsModule?.leadSponsor?.name, 90),
      lastUpdated: shortString(section?.statusModule?.lastUpdatePostDateStruct?.date, 30),
      resultsReported: row.hasResults === true,
    }];
  });
}

export async function getTopicTrials(topic: (typeof PUBLIC_RESEARCH_TOPICS)[number]): Promise<TopicTrials> {
  const checkedAt = new Date().toISOString();
  try {
    const url = new URL("https://clinicaltrials.gov/api/v2/studies");
    url.searchParams.set("query.term", topic.label);
    url.searchParams.set("pageSize", "8");
    url.searchParams.set("countTotal", "false");
    url.searchParams.set("format", "json");
    const response = await fetch(url.toString(), {
      headers: { accept: "application/json" },
      next: { revalidate: 21_600 },
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) throw new Error("Registry request failed");
    const payload: unknown = await response.json();
    // An invalid API schema or a page of malformed records is not a result
    // set containing zero studies. Fail closed rather than publishing an
    // incorrect "nothing on record" inference.
    if (!payload || typeof payload !== "object" || !("studies" in payload)) {
      throw new Error("Unexpected registry response");
    }
    const raw = (payload as { studies: unknown }).studies;
    if (!Array.isArray(raw)) throw new Error("Unexpected registry studies");
    const studies = parseTrialRegistryResponse(payload).slice(0, 8);
    if (raw.length > 0 && studies.length === 0) {
      throw new Error("Registry records could not be verified");
    }
    return { ...topic, studies, unavailable: false, checkedAt };
  } catch {
    // Network or API faults are not the same as a trial search returning no records.
    return { ...topic, studies: [], unavailable: true, checkedAt };
  }
}

export async function fetchPublicTrialIndex(): Promise<TopicTrials[]> {
  return Promise.all(PUBLIC_RESEARCH_TOPICS.map(getTopicTrials));
}

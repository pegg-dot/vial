/**
 * Metadata-only research discovery via OpenAlex (CC0 metadata).
 * Fixed preselected search topics: no visitor queries, profiles or identifiers
 * are sent upstream, and we do not fetch or reproduce protected article text.
 */
import { PUBLIC_RESEARCH_TOPICS } from "./public-trials";

export type ResearchPublication = {
  id: string;
  title: string;
  published: string | null;
  doiUrl: string | null;
  kind: string;
  venue: string | null;
  retracted: boolean;
};

export type TopicPublications = {
  key: string;
  label: string;
  works: ResearchPublication[];
  unavailable: boolean;
  checkedAt: string;
};

type WorkRow = {
  id?: unknown;
  display_name?: unknown;
  publication_date?: unknown;
  doi?: unknown;
  type?: unknown;
  is_retracted?: unknown;
  primary_location?: { source?: { display_name?: unknown } | null } | null;
};

function stringOrNull(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

function validDate(raw: unknown): string | null {
  const text = stringOrNull(raw, 10);
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  if (Number.isNaN(Date.parse(text))) return null;
  return text;
}

function validDoiUrl(raw: unknown): string | null {
  const value = stringOrNull(raw, 340);
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "doi.org") return null;
    if (!/^\/10\.\d{4,9}\/.+/.test(url.pathname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function parsePublicationResponse(payload: unknown): ResearchPublication[] {
  if (!payload || typeof payload !== "object" || !("results" in payload)) return [];
  const records = (payload as { results?: unknown }).results;
  if (!Array.isArray(records)) return [];
  const seen = new Set<string>();

  return records.slice(0, 24).flatMap((value): ResearchPublication[] => {
    if (!value || typeof value !== "object") return [];
    const record = value as WorkRow;
    const id = stringOrNull(record.id, 90);
    const title = stringOrNull(record.display_name, 300);
    if (!id || !/^https:\/\/openalex\.org\/W\d+$/.test(id) || !title || seen.has(id)) return [];
    seen.add(id);
    return [{
      id,
      title,
      published: validDate(record.publication_date),
      doiUrl: validDoiUrl(record.doi),
      kind: stringOrNull(record.type, 40) ?? "unclassified",
      venue: stringOrNull(record.primary_location?.source?.display_name, 110),
      retracted: record.is_retracted === true,
    }];
  });
}

export async function getTopicPublications(topic: (typeof PUBLIC_RESEARCH_TOPICS)[number]): Promise<TopicPublications> {
  const checkedAt = new Date().toISOString();
  try {
    const url = new URL("https://api.openalex.org/works");
    url.searchParams.set("search", topic.label);
    url.searchParams.set("sort", "publication_date:desc");
    url.searchParams.set("per_page", "8");
    url.searchParams.set("select", "id,display_name,publication_date,doi,type,is_retracted,primary_location");
    // API key is optional. It is server-side only, never exposed to a browser.
    const key = process.env.OPENALEX_API_KEY?.trim();
    if (key) url.searchParams.set("api_key", key);
    const response = await fetch(url.toString(), {
      headers: { accept: "application/json" },
      next: { revalidate: 21_600 },
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) throw new Error("OpenAlex unavailable");
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("results" in payload)) throw new Error("Invalid metadata response");
    const raw = (payload as { results: unknown }).results;
    if (!Array.isArray(raw)) throw new Error("Malformed research records");
    const works = parsePublicationResponse(payload).slice(0, 8);
    if (raw.length > 0 && works.length === 0) throw new Error("No parseable source metadata");
    return { key: topic.key, label: topic.label, checkedAt, works, unavailable: false };
  } catch {
    // An API/rate-limit failure is not evidence of zero publications.
    return { key: topic.key, label: topic.label, checkedAt, works: [], unavailable: true };
  }
}

export async function getPublicPublicationIndex(): Promise<TopicPublications[]> {
  return Promise.all(PUBLIC_RESEARCH_TOPICS.map(getTopicPublications));
}

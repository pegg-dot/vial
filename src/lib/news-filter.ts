// Filtering and topic derivation for /news. Pure, so the same code runs in the server render and in
// the client filter, and so the topic table can be tested against the real corpus.
//
// `news_items` has exactly one classification column — `source_type`, four values (see
// src/server/collect/news.ts SOURCE_TYPES). There is no tag, topic, or keyword column, and no
// full-text index. Topics here are therefore DERIVED from the headline and summary, never sourced.
// The UI says so: a derived label must not read like a publisher's own classification.
//
// Rules for the keyword table:
// - Every term is checked against a case-folded `title + summary + publisher` haystack.
// - A row that matches nothing gets NO topic. Guessing a bucket is worse than leaving it to "All",
//   because a wrong chip hides a record from the person filtering for exactly it.
// - Terms are deliberately narrow. "action" or "letter" would match half the corpus; "warning
//   letter" and "exclusion order" name real instruments.

export interface NewsRow {
  id: string;
  vendor_slug: string | null;
  title: string;
  publisher: string | null;
  news_date: string | null;
  summary: string;
  source_url: string;
  source_type: string;
  vendor_name?: string | null;
}

export type NewsTopicId = "recall" | "enforcement" | "lawsuit" | "vendor-exit" | "glp1" | "policy" | "contamination";

export interface NewsTopic {
  id: NewsTopicId;
  label: string;
  /** Shown on the chip's title attribute — what a reader is actually selecting. */
  note: string;
  terms: string[];
}

export const NEWS_TOPICS: NewsTopic[] = [
  {
    id: "recall",
    label: "Recalls",
    note: "A product was pulled from the market",
    terms: ["recall", "recalled", "recalling", "withdrawn from the market", "market withdrawal"],
  },
  {
    id: "enforcement",
    label: "Enforcement",
    note: "A regulator or prosecutor acted against a seller",
    terms: [
      "warning letter", "guilty plea", "pleaded guilty", "pled guilty", "indict", "prosecut",
      "seiz", "raid", "exclusion order", "injunction", "consent decree", "department of justice",
      "doj", "criminal", "import alert", "enforcement",
    ],
  },
  {
    id: "lawsuit",
    label: "Lawsuits",
    note: "A private civil action between companies",
    terms: ["sues", "sued", "lawsuit", "files suit", "filed suit", "complaint against", "itc complaint", "respondent", "infringement"],
  },
  {
    id: "vendor-exit",
    label: "Vendor shutdowns",
    note: "A vendor closed, wound down, or went dark",
    terms: ["shuts down", "shutdown", "shut down", "wind-down", "winds down", "voluntary closure", "closes", "closure", "goes dark", "went dark", "ceased operations", "exits"],
  },
  {
    id: "glp1",
    label: "GLP-1s",
    note: "Semaglutide, tirzepatide, and the weight-loss market",
    terms: ["glp-1", "glp1", "semaglutide", "tirzepatide", "retatrutide", "weight-loss", "weight loss", "ozempic", "wegovy", "mounjaro", "zepbound"],
  },
  {
    id: "policy",
    label: "Policy & rules",
    note: "A rule, guidance, or scheduling change — not an action against one seller",
    terms: ["compounding policy", "guidance", "final rule", "proposed rule", "federal register", "reclassif", "schedul", "503a", "503b", "shortage list", "policy", "deadline"],
  },
  {
    id: "contamination",
    label: "Contamination & purity",
    note: "Sterility, endotoxin, mislabeling, or wrong-ingredient findings",
    terms: ["endotoxin", "steril", "contaminat", "mislabel", "adulterat", "impurit", "misbrand", "actually contained", "unapproved new drug", "bacterial"],
  },
];

function haystack(item: Pick<NewsRow, "title" | "summary" | "publisher">) {
  return `${item.title} ${item.summary} ${item.publisher ?? ""}`.toLowerCase();
}

export function classifyNewsTopics(item: Pick<NewsRow, "title" | "summary" | "publisher">): NewsTopicId[] {
  const text = haystack(item);
  return NEWS_TOPICS.filter((topic) => topic.terms.some((term) => text.includes(term))).map((topic) => topic.id);
}

export interface NewsFilters {
  query?: string;
  sourceTypes?: string[];
  topics?: NewsTopicId[];
}

export const EMPTY_NEWS_FILTERS: Required<NewsFilters> = { query: "", sourceTypes: [], topics: [] };

export function hasActiveNewsFilters(filters: NewsFilters) {
  return Boolean(filters.query?.trim()) || Boolean(filters.sourceTypes?.length) || Boolean(filters.topics?.length);
}

/**
 * Filters intersect: every active dimension must match. A union would mean adding a filter can
 * ADD results, which is the opposite of what a person clicking a chip expects.
 */
export function filterNews(rows: NewsRow[], filters: NewsFilters): NewsRow[] {
  const query = filters.query?.trim().toLowerCase() ?? "";
  const sourceTypes = filters.sourceTypes ?? [];
  const topics = filters.topics ?? [];
  return rows.filter((row) => {
    if (sourceTypes.length && !sourceTypes.includes(row.source_type)) return false;
    if (topics.length) {
      const rowTopics = classifyNewsTopics(row);
      if (!topics.some((topic) => rowTopics.includes(topic))) return false;
    }
    if (query) {
      // The vendor name is searchable because it is what a reader knows the company by; the slug
      // is searchable because it is what the URL shows them.
      const text = `${row.title} ${row.summary} ${row.publisher ?? ""} ${row.vendor_name ?? ""} ${row.vendor_slug ?? ""}`.toLowerCase();
      if (!text.includes(query)) return false;
    }
    return true;
  });
}

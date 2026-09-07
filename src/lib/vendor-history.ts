import type { Vendor } from "@/lib/types";

// A vendor's history feed is written one row per listing touched. A single reviewed price refresh
// therefore lands as a dozen near-identical rows on one date — "Epithalon price updated through a
// reviewed source", then PT-141, then AOD-9604 — and the rail outgrows the catalog beside it while
// telling the reader one thing. Grouping folds each of those runs back into the single event it
// actually was, without dropping a subject: the shared phrase becomes the headline and the parts
// that differed become the subject list, so the row still names every compound it covers.

export type HistoryItem = Vendor["history"][number];

export type HistoryGroup = {
  date: string;
  type: HistoryItem["type"];
  // The phrase every entry in the group shares, sentence-cased. For a lone entry this is the event
  // verbatim.
  headline: string;
  // What differed between the entries — one per entry, in feed order. Empty when the group is a
  // single entry, or when every entry was byte-identical and there is nothing to distinguish.
  subjects: string[];
  count: number;
};

const words = (event: string) => event.split(/\s+/).filter(Boolean);

// Two entries only merge when they end in the same two words. That is a deliberately conservative
// signature: it keeps unrelated same-day events apart, and it guarantees any group we do form has a
// shared tail long enough to read as a phrase rather than a stray verb.
const SIGNATURE_WORDS = 2;

function signature(event: string) {
  const parts = words(event);
  return parts.length < SIGNATURE_WORDS ? event.toLowerCase() : parts.slice(-SIGNATURE_WORDS).join(" ").toLowerCase();
}

// The longest run of trailing words shared by every entry, as a word count. Compared the same way
// the signature is — case-insensitively — so a tail that put two entries in one bucket cannot then
// fail to count as shared and leave a stray word standing in as somebody's subject.
function commonSuffixLength(entries: string[][]) {
  const shortest = Math.min(...entries.map((parts) => parts.length));
  let shared = 0;
  while (shared < shortest) {
    const word = entries[0][entries[0].length - 1 - shared].toLowerCase();
    if (!entries.every((parts) => parts[parts.length - 1 - shared].toLowerCase() === word)) break;
    shared += 1;
  }
  return shared;
}

const sentenceCase = (phrase: string) => (phrase ? phrase.charAt(0).toUpperCase() + phrase.slice(1) : phrase);

const single = (item: HistoryItem): HistoryGroup => ({ date: item.date, type: item.type, headline: item.event, subjects: [], count: 1 });

export function groupVendorHistory(history: HistoryItem[]): HistoryGroup[] {
  // Buckets keep the order of their first entry, so the rail stays newest-first however the feed
  // interleaves types within a day.
  const buckets = new Map<string, HistoryItem[]>();
  for (const item of history) {
    const key = `${item.date} ${item.type} ${signature(item.event)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  const groups: HistoryGroup[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.length === 1) {
      groups.push(single(bucket[0]));
      continue;
    }
    const parts = bucket.map((item) => words(item.event));
    const shared = commonSuffixLength(parts);
    const subjects = parts.map((entry) => entry.slice(0, entry.length - shared).join(" "));
    if (subjects.every((subject) => subject === "")) {
      // Identical repeats: one row, counted, with nothing left to list.
      groups.push({ date: bucket[0].date, type: bucket[0].type, headline: bucket[0].event, subjects: [], count: bucket.length });
      continue;
    }
    if (subjects.some((subject) => subject === "")) {
      // One entry is exactly the tail of another. There is no subject to show for it, so a merged
      // row would have to invent one — leave the bucket unmerged instead.
      for (const item of bucket) groups.push(single(item));
      continue;
    }
    groups.push({ date: bucket[0].date, type: bucket[0].type, headline: sentenceCase(parts[0].slice(parts[0].length - shared).join(" ")), subjects, count: bucket.length });
  }
  return groups;
}

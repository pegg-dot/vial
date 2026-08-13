// Real market-news collection.
//
// `/news` rendered "No news on record yet." in production because `news_items` was fed only by a
// hand-curated JSON file sitting in `scripts/`, which the serverless bundle never contained. Two
// streams now feed it from inside the deployment:
//
//   1. A CURATED BASELINE (`src/server/data/news-items.json`) — the sourced market history
//      (the GLP-1 compounding wave, the ITC exclusion order, the vendor shutdowns). Static-imported,
//      so a deployment can actually read it.
//   2. LIVE GOVERNMENT RSS — FDA press releases, FDA MedWatch safety alerts, and FDA recalls. All
//      three were verified to return data using the exact user-agent `safeFetch` sends.
//
// Chosen against the alternatives, all rejected on evidence rather than taste: justice.gov/news/rss
// and the FTC press feed both answer a server-side client with 403 (Akamai bot protection — it
// rejects our real user-agent, and spoofing a browser to get around that is not something a
// citable source pipeline should do). A feed that 403s would sit in the queue failing forever.
//
// RELEVANCE IS THE HARD PART. These are general-purpose government feeds — most of FDA's output is
// device approvals and veterinary authorizations. An item is stored only if it names a compound
// this market tracks or a market-specific term. A news page padded with screwworm advisories is
// worse than an empty one.
//
// ATTRIBUTION: an item is pinned to a vendor only when the article text literally contains that
// vendor's domain. The same strict high/none resolver the enforcement path uses — a story that
// merely resembles a vendor's name stays unattributed.

import type { SqlConnection } from "@/server/db/client";
import { safeFetch } from "@/server/refresh/safe-fetch";
import { recordNewsItem } from "@/server/external/repository";
import { resolveActionToVendor, type VendorRef } from "@/server/regulatory/actions";
import { cleanText, safeSourceUrl, toIsoDate } from "./source-text";
import { liveVendorRefs } from "./enforcement";
import type { CollectorOutcome } from "./types";
import curatedNewsJson from "@/server/data/news-items.json";

export interface NewsFeedSource {
  url: string;
  publisher: string;
  sourceType: string;
}

/** Verified live and returning items. Every one is a primary-source government publisher, so they
 *  carry the `trade` ("Official record") badge on `/news`. */
export const NEWS_FEEDS: NewsFeedSource[] = [
  { url: "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml", publisher: "U.S. Food & Drug Administration", sourceType: "trade" },
  { url: "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/medwatch/rss.xml", publisher: "FDA MedWatch", sourceType: "trade" },
  { url: "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/recalls/rss.xml", publisher: "FDA Recalls, Market Withdrawals & Safety Alerts", sourceType: "trade" },
];

/** The only hosts this collector may reach, and the only hosts a stored `source_url` may point at. */
export const NEWS_HOSTNAMES = ["www.fda.gov"];

const MAX_ITEMS_PER_FEED = 60;

// ── RSS parsing ──────────────────────────────────────────────────────────────────────────────────

export interface RssItem { title: string; link: string; description: string; pubDate: string }

function tagValue(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? match[1]! : "";
}

/**
 * Extract `<item>` blocks from an RSS document.
 *
 * Hand-rolled rather than pulled through an XML library on purpose: the feed is untrusted input,
 * this reads four known text fields and nothing else, and it cannot be talked into resolving an
 * external entity. Bounded by `MAX_ITEMS_PER_FEED` so a hostile or runaway feed cannot make the
 * collector allocate without limit.
 */
export function parseRssItems(xml: string, limit = MAX_ITEMS_PER_FEED): RssItem[] {
  if (typeof xml !== "string" || !xml) return [];
  const items: RssItem[] = [];
  const blocks = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) ?? [];
  for (const block of blocks.slice(0, limit)) {
    const title = cleanText(tagValue(block, "title"), 300);
    const link = cleanText(tagValue(block, "link"), 500) || cleanText(tagValue(block, "guid"), 500);
    if (!title || !link) continue;
    items.push({
      title,
      link,
      description: cleanText(tagValue(block, "description"), 1200),
      pubDate: cleanText(tagValue(block, "pubDate"), 80),
    });
  }
  return items;
}

// ── relevance ────────────────────────────────────────────────────────────────────────────────────

/**
 * Market-specific vocabulary. Deliberately narrow — every term here describes the research-peptide
 * / compounded-GLP-1 / SARM market rather than pharma generally, because a term like "recall" or
 * "injection" would let the entire FDA feed through.
 */
export const MARKET_TERMS = [
  "peptide", "compounded", "compounding pharmac", "outsourcing facility",
  "glp-1", "glp1", "sarm", "selective androgen receptor",
  "research chemical", "research-use-only", "for research use only",
  "unapproved new drug", "unapproved drug", "misbranded drug", "counterfeit drug",
  "anabolic steroid", "weight-loss drug", "weight loss drug",
  "bacteriostatic", "nootropic", "tianeptine", "kratom",
];

/** True when the text names a tracked compound or a market term. Case-insensitive substring match
 *  over the article's own words; it never guesses from a headline's tone. */
export function isMarketRelevant(text: string, compoundTerms: string[] = []): boolean {
  const haystack = (text ?? "").toLowerCase();
  if (!haystack) return false;
  for (const term of MARKET_TERMS) if (haystack.includes(term)) return true;
  for (const term of compoundTerms) if (term.length >= 5 && haystack.includes(term.toLowerCase())) return true;
  return false;
}

export interface MappedNewsItem {
  title: string; publisher: string; newsDate: string | null; summary: string;
  sourceUrl: string; sourceType: string; vendorSlug: string | null;
}

/**
 * One RSS item to a `news_items` input, or null if it cannot be stored honestly — an off-host or
 * non-http link, or an item with no usable summary to show a reader.
 */
export function mapRssItem(item: RssItem, feed: NewsFeedSource, vendors: VendorRef[] = []): MappedNewsItem | null {
  const sourceUrl = safeSourceUrl(item.link, NEWS_HOSTNAMES);
  const title = cleanText(item.title, 300);
  if (!sourceUrl || !title) return null;

  const summary = cleanText(item.description, 900);
  // Strict attribution: this only ever fires when the article text literally contains a vendor's
  // domain. A name that merely looks similar resolves to "none" and stays unattributed.
  const resolved = resolveActionToVendor(`${title} ${summary}`, vendors);
  return {
    title,
    publisher: feed.publisher,
    newsDate: toIsoDate(item.pubDate),
    summary: summary || title,
    sourceUrl,
    sourceType: feed.sourceType,
    vendorSlug: resolved.confidence === "high" ? resolved.vendorSlug : null,
  };
}

// ── curated baseline ─────────────────────────────────────────────────────────────────────────────

const SOURCE_TYPES = new Set(["trade", "news", "blog", "forum"]);

export function normalizeCuratedNews(raw: unknown): MappedNewsItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = cleanText(typeof r.title === "string" ? r.title : "", 300);
  const sourceUrl = typeof r.sourceUrl === "string" ? r.sourceUrl.trim() : "";
  if (!title || !sourceUrl) return null;
  const sourceType = typeof r.sourceType === "string" && SOURCE_TYPES.has(r.sourceType) ? r.sourceType : "news";
  return {
    title,
    publisher: cleanText(typeof r.publisher === "string" ? r.publisher : "", 160),
    newsDate: toIsoDate(typeof r.newsDate === "string" ? r.newsDate : null),
    summary: cleanText(typeof r.summary === "string" ? r.summary : "", 1400) || title,
    sourceUrl,
    sourceType,
    vendorSlug: typeof r.vendorSlug === "string" && r.vendorSlug.trim() ? r.vendorSlug.trim() : null,
  };
}

export function curatedNews(): MappedNewsItem[] {
  const list = Array.isArray(curatedNewsJson) ? curatedNewsJson : [];
  return list.map(normalizeCuratedNews).filter((n): n is MappedNewsItem => n !== null);
}

// ── collection ───────────────────────────────────────────────────────────────────────────────────

export type TextFetcher = (url: string) => Promise<string>;

/** The real transport — `safeFetch`, hostname-allowlisted, never bare `fetch`. */
export const fetchFeedText: TextFetcher = async (url) => {
  const response = await safeFetch(url, {
    allowedHostnames: NEWS_HOSTNAMES,
    allowedContentTypes: ["application/rss+xml", "application/xml", "text/xml"],
    timeoutMs: 20_000,
    maxResponseBytes: 6 * 1024 * 1024,
    maxRedirects: 2,
  });
  return response.body;
};

export interface NewsCollectionOptions {
  fetchText?: TextFetcher;
  feeds?: NewsFeedSource[];
  compoundTerms?: string[];
  includeCurated?: boolean;
}

async function compoundTermsFromCatalog(db: SqlConnection): Promise<string[]> {
  const rows = (await db.query<{ canonical_name: string }>(`SELECT canonical_name FROM compounds`)).rows;
  return rows.map((r) => String(r.canonical_name ?? "").toLowerCase().trim()).filter((t) => t.length >= 5);
}

/**
 * Run one news pass. Never throws for a source problem: a feed that 403s, times out, or changes
 * shape settles as `ok: false` while the bundled baseline still lands, because the baseline cannot
 * fail.
 */
export async function collectNews(db: SqlConnection, options: NewsCollectionOptions = {}): Promise<CollectorOutcome> {
  const fetchText = options.fetchText ?? fetchFeedText;
  const feeds = options.feeds ?? NEWS_FEEDS;
  const vendors = await liveVendorRefs(db);
  let items = 0;

  if (options.includeCurated !== false) {
    for (const item of curatedNews()) {
      await recordNewsItem(db, item);
      items += 1;
    }
  }

  const compounds = options.compoundTerms ?? await compoundTermsFromCatalog(db);
  const seen = new Set<string>();
  const failures: string[] = [];
  let liveItems = 0;

  for (const feed of feeds) {
    let xml: string;
    try {
      xml = await fetchText(feed.url);
    } catch (error) {
      // One dead feed must not lose the feeds that worked.
      failures.push(`${feed.publisher}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    for (const raw of parseRssItems(xml)) {
      if (!isMarketRelevant(`${raw.title} ${raw.description}`, compounds)) continue;
      const mapped = mapRssItem(raw, feed, vendors);
      if (!mapped) continue;
      const key = `${mapped.sourceUrl} ${mapped.title}`; // matches the table's uniqueness
      if (seen.has(key)) continue;
      seen.add(key);
      await recordNewsItem(db, mapped);
      liveItems += 1;
    }
  }

  items += liveItems;

  if (feeds.length > 0 && failures.length === feeds.length) {
    return { items, ok: false, error: `all news feeds failed — ${failures[0]}`.slice(0, 400) };
  }
  if (liveItems === 0) {
    // Genuinely possible: government feeds carry ~30 recent items each and a quiet fortnight may
    // contain nothing about this market. Recording it as not-ok is still right — it is exactly the
    // signal `detectBrokenCollectors` needs if the feeds silently change shape and stop matching.
    return { items, ok: false, error: "no market-relevant items in any feed this run" };
  }
  return { items, ok: true };
}

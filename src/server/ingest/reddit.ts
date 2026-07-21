// r/Peptides ingestion — the community-reputation layer.
//
// Reddit's public search.json blocks datacenter IPs, so a real signal needs authenticated
// OAuth. This module authenticates with a Reddit "script" app, searches r/Peptides for a
// vendor, classifies each hit (scam complaint vs. vouch), and stores one honest aggregated
// snapshot per vendor in community_mentions.
//
// INERT until credentials exist. With no REDDIT_CLIENT_ID/SECRET it never touches the network
// (searchPeptides returns a public-endpoint best-effort that degrades to null when blocked),
// so this is safe to ship switched off — exactly like the other live-ingest capabilities.
//
// Setup: create a "script" app at https://reddit.com/prefs/apps, then set
//   REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET
// and optionally REDDIT_USERNAME + REDDIT_PASSWORD (developer account) for the password grant.

import type { SqlConnection } from "@/server/db/client";
import { newId } from "@/server/db/ids";

const UA = "web:vial-market-intelligence:v1.0 (by /u/vial-research)";

export function hasRedditCreds(): boolean {
  return Boolean(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
}

export interface RedditPost { title: string; url: string; ups: number; body: string }
export type MentionFlag = "negative" | "positive" | "neutral";
export interface ClassifiedPost extends RedditPost { flag: MentionFlag }

// ---- OAuth ----

let cachedToken: { token: string; expiresAt: number } | null = null;

/** Get a Reddit OAuth token. Prefers the password grant when a dev account is configured,
 *  otherwise the userless client_credentials grant. Cached until shortly before expiry. */
async function getToken(now: number): Promise<string | null> {
  if (!hasRedditCreds()) return null;
  if (cachedToken && cachedToken.expiresAt > now + 30_000) return cachedToken.token;

  const basic = Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString("base64");
  const body = process.env.REDDIT_USERNAME && process.env.REDDIT_PASSWORD
    ? new URLSearchParams({ grant_type: "password", username: process.env.REDDIT_USERNAME, password: process.env.REDDIT_PASSWORD })
    : new URLSearchParams({ grant_type: "client_credentials" });

  try {
    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded", "user-agent": UA },
      body,
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    cachedToken = { token: data.access_token, expiresAt: now + (data.expires_in ?? 3600) * 1000 };
    return cachedToken.token;
  } catch {
    return null;
  }
}

// ---- search ----

interface RedditListing { data?: { children?: { data: { title?: string; selftext?: string; permalink?: string; ups?: number } }[] } }

function toPosts(json: RedditListing): RedditPost[] {
  return (json.data?.children ?? []).map((c) => ({
    title: c.data.title ?? "",
    body: c.data.selftext ?? "",
    url: c.data.permalink ? `https://www.reddit.com${c.data.permalink}` : "",
    ups: Number(c.data.ups ?? 0),
  })).filter((p) => p.title);
}

/** Search r/Peptides for a phrase. Authenticated when creds exist; otherwise a best-effort
 *  public call that returns null if Reddit blocks it. `authed` tells the caller which path ran. */
export async function searchPeptides(query: string, opts: { limit?: number; now?: number } = {}): Promise<{ posts: RedditPost[]; authed: boolean } | null> {
  const limit = opts.limit ?? 15;
  const now = opts.now ?? Date.now();
  const q = encodeURIComponent(`"${query}"`);
  const token = await getToken(now);

  if (token) {
    try {
      const res = await fetch(`https://oauth.reddit.com/r/Peptides/search?q=${q}&restrict_sr=1&limit=${limit}&sort=relevance&type=link`, {
        headers: { authorization: `Bearer ${token}`, "user-agent": UA },
        signal: AbortSignal.timeout(9000),
      });
      if (res.ok) return { posts: toPosts((await res.json()) as RedditListing), authed: true };
    } catch { /* fall through to public */ }
  }

  try {
    const res = await fetch(`https://www.reddit.com/r/Peptides/search.json?q=${q}&restrict_sr=1&limit=${limit}&sort=relevance`, {
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return null;
    return { posts: toPosts((await res.json()) as RedditListing), authed: false };
  } catch {
    return null;
  }
}

// ---- classification ----

const NEG = /\bscam|fake|counterfeit|underdos|bunk|ripped?\s*off|rip[\s-]?off|did\s?n.?t (arrive|receive|ship|come)|never (arrived|shipped|received)|no (response|refund)|stole|fraud|avoid|shady|sketch|bad batch|contaminat|failed test|low purity\b/i;
const POS = /\bg2g|good to go|legit|trusted|reliable|recommend|vouch|solid|great experience|no issues|came through|third[\s-]?party test|passed test|high purity\b/i;

export function classifyPost(post: RedditPost): MentionFlag {
  const text = `${post.title} ${post.body}`;
  if (NEG.test(text)) return "negative";
  if (POS.test(text)) return "positive";
  return "neutral";
}

export interface CommunitySignal {
  vendorSlug: string | null;
  query: string;
  mentionCount: number;
  negativeCount: number;
  positiveCount: number;
  sentiment: "positive" | "mixed" | "negative" | "unknown";
  topPosts: { title: string; url: string; flag: MentionFlag; ups: number }[];
  authed: boolean;
}

function sentimentOf(mention: number, neg: number, pos: number): CommunitySignal["sentiment"] {
  if (mention === 0) return "unknown";
  if (neg >= 2 && neg >= pos) return "negative";
  if (pos > 0 && neg === 0) return "positive";
  return "mixed";
}

/** Search + classify a vendor into a community signal (no DB writes). */
export async function buildCommunitySignal(query: string, vendorSlug: string | null, opts: { now?: number } = {}): Promise<CommunitySignal | null> {
  const result = await searchPeptides(query, { now: opts.now });
  if (!result) return null;
  const classified: ClassifiedPost[] = result.posts.map((p) => ({ ...p, flag: classifyPost(p) }));
  const negativeCount = classified.filter((p) => p.flag === "negative").length;
  const positiveCount = classified.filter((p) => p.flag === "positive").length;
  // Prioritize flagged posts, then by upvotes — the ones a buyer should actually read.
  const topPosts = [...classified]
    .sort((a, b) => (a.flag === "neutral" ? 1 : 0) - (b.flag === "neutral" ? 1 : 0) || b.ups - a.ups)
    .slice(0, 5)
    .map((p) => ({ title: p.title, url: p.url, flag: p.flag, ups: p.ups }));
  return {
    vendorSlug, query,
    mentionCount: classified.length, negativeCount, positiveCount,
    sentiment: sentimentOf(classified.length, negativeCount, positiveCount),
    topPosts, authed: result.authed,
  };
}

// ---- persistence ----

/** Ingest one vendor's r/Peptides reputation and store it (idempotent on source+subreddit+query). */
export async function ingestVendorReddit(db: SqlConnection, vendor: { slug: string; name: string }, opts: { now?: number } = {}): Promise<CommunitySignal | null> {
  const signal = await buildCommunitySignal(vendor.name, vendor.slug, opts);
  if (!signal) return null;
  await db.query(
    `INSERT INTO community_mentions (id, source, subreddit, vendor_slug, query, mention_count, negative_count, positive_count, sentiment, top_posts, origin, fetched_at)
     VALUES ($1,'reddit','Peptides',$2,$3,$4,$5,$6,$7,$8,'live',NOW())
     ON CONFLICT (source, subreddit, query) DO UPDATE SET
       vendor_slug = EXCLUDED.vendor_slug, mention_count = EXCLUDED.mention_count,
       negative_count = EXCLUDED.negative_count, positive_count = EXCLUDED.positive_count,
       sentiment = EXCLUDED.sentiment, top_posts = EXCLUDED.top_posts, fetched_at = NOW()`,
    [newId("commention"), vendor.slug, vendor.name, signal.mentionCount, signal.negativeCount, signal.positiveCount, signal.sentiment, JSON.stringify(signal.topPosts)],
  );
  return signal;
}

export interface StoredCommunitySignal {
  vendor_slug: string | null; query: string; mention_count: number; negative_count: number;
  positive_count: number; sentiment: string; top_posts: { title: string; url: string; flag: MentionFlag; ups: number }[]; fetched_at: string;
}

/** Read the stored community signal for a vendor (fast path for pages/verify). */
export async function getStoredCommunitySignal(db: SqlConnection, vendorSlug: string): Promise<StoredCommunitySignal | null> {
  const r = await db.query<StoredCommunitySignal>(
    `SELECT vendor_slug, query, mention_count, negative_count, positive_count, sentiment, top_posts, fetched_at
       FROM community_mentions WHERE vendor_slug = $1 ORDER BY fetched_at DESC LIMIT 1`,
    [vendorSlug],
  );
  return r.rows[0] ?? null;
}

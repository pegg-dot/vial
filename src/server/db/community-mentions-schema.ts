// Migration 16 — community mentions (r/Peptides reputation signal).
//
// Reddit's r/Peptides is where the grey market actually vets vendors: scam reports, "G2G"
// vouches, underdosing complaints. The public search endpoint blocks datacenter traffic, so
// this is populated through authenticated Reddit OAuth ingestion. Each row is one aggregated
// snapshot of what the community says about one vendor, kept honest with counts + real links.
//
// It is a reputation SIGNAL, never a verdict: silence isn't safety and mentions aren't proof.
export const communityMentionsSchemaSql = `
CREATE TABLE IF NOT EXISTS community_mentions (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'reddit',
  subreddit TEXT NOT NULL DEFAULT 'Peptides',
  vendor_slug TEXT,                       -- resolved vendor (nullable if search was ad hoc)
  query TEXT NOT NULL,                    -- exactly what we searched for
  mention_count INTEGER NOT NULL DEFAULT 0,
  negative_count INTEGER NOT NULL DEFAULT 0,   -- scam / quality complaints
  positive_count INTEGER NOT NULL DEFAULT 0,   -- vouches / good experiences
  sentiment TEXT NOT NULL DEFAULT 'unknown',   -- positive | mixed | negative | unknown
  top_posts JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{title,url,flag,ups}]
  origin TEXT NOT NULL DEFAULT 'live',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source, subreddit, query)
);
CREATE INDEX IF NOT EXISTS idx_community_mentions_vendor ON community_mentions(vendor_slug);
`;

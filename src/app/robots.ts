import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-static";

// Crawlers that produce CITATIONS in AI answers, named explicitly so they match this group instead
// of inheriting the wildcard group below.
//
// This is not cosmetic. Under RFC 9309 a crawler obeys the MOST SPECIFIC matching group, and the
// wildcard group carries a Crawl-delay. Anthropic documents that it honours Crawl-delay; Google
// documents that it ignores it. So a delay on the wildcard group throttled precisely the crawlers
// we want and left the ones we don't unaffected — the exact opposite of the intent.
//
// The training-vs-citation split resolves trivially for this site: it sells nothing, so being in a
// model's weights is a benefit, not a cost. Hence GPTBot and ClaudeBot (training) are allowed
// alongside OAI-SearchBot, Claude-SearchBot and PerplexityBot (citations). Note Google-Extended
// does NOT control AI Overviews — those are served from the ordinary Search index via Googlebot —
// but it does control Gemini grounding, which is its own citation surface.
const CITATION_CRAWLERS = [
  "OAI-SearchBot", "ChatGPT-User", "GPTBot", "OAI-AdsBot",
  "Claude-SearchBot", "Claude-User", "ClaudeBot",
  "PerplexityBot", "Perplexity-User",
  "Googlebot", "Google-Extended", "GoogleOther",
  "Applebot", "Applebot-Extended", "Bingbot", "CCBot",
];

// Commercial SEO and dataset scrapers. These crawl aggressively and repeatedly, send no visitors,
// and cannot buy anything — this site sells nothing. Every one of their hits used to recompute a
// catalog page from the database, so they were pure cost: a single sweep re-read the entire catalog
// once per vendor page. They are the reason a site with no users exhausted a database quota.
const FREELOADERS = [
  "AhrefsBot", "SemrushBot", "MJ12bot", "DotBot", "PetalBot", "Bytespider",
  "DataForSeoBot", "BLEXBot", "SeekportBot", "ZoominfoBot", "Barkrowler",
  "serpstatbot", "MegaIndex", "Screaming Frog SEO Spider",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Named first and WITHOUT a crawl delay. /api/ stays open to these because it holds the
      // machine-readable surface (/api/openapi.json, /api/search) that is worth being read.
      { userAgent: CITATION_CRAWLERS, allow: "/", disallow: ["/admin", "/account", "/go"] },
      // Everything else: welcome, but paced, since an unknown crawler is a cost with no upside.
      { userAgent: "*", allow: "/", crawlDelay: 10, disallow: ["/api/", "/admin", "/account", "/go"] },
      ...FREELOADERS.map((userAgent) => ({ userAgent, disallow: "/" })),
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

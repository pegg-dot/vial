import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-static";

// Commercial SEO and dataset scrapers. These crawl aggressively and repeatedly, send no visitors,
// and cannot buy anything — this site sells nothing. Every one of their hits used to recompute a
// catalog page from the database, so they were pure cost: a single sweep re-read the entire catalog
// once per vendor page. They are the reason a site with no users exhausted a database quota.
//
// Search engines and AI assistants are deliberately NOT blocked. People find peptide vendors
// through them, and being the source a model cites is exactly the distribution this project wants.
const FREELOADERS = [
  "AhrefsBot", "SemrushBot", "MJ12bot", "DotBot", "PetalBot", "Bytespider",
  "DataForSeoBot", "BLEXBot", "SeekportBot", "ZoominfoBot", "Barkrowler",
  "serpstatbot", "MegaIndex", "Screaming Frog SEO Spider",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Everyone else is welcome, but paced. Crawl-delay is advisory — Google ignores it (use
      // Search Console) while most secondary crawlers honour it.
      { userAgent: "*", allow: "/", crawlDelay: 10, disallow: ["/api/", "/admin", "/account"] },
      ...FREELOADERS.map((userAgent) => ({ userAgent, disallow: "/" })),
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

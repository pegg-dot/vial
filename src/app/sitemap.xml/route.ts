import { siteUrl } from "@/lib/site";
import { STACKS, resolveStack } from "@/lib/stacks";
import { getCatalogSnapshot } from "@/server/catalog/repository";
import { listSitemapPassportSlugs } from "@/server/evidence-network/repository";
// Laboratories come from a static registry in code, NOT the laboratory_profiles table — /labs
// renders LAB_REGISTRY. Querying the table returned zero rows and the catch hid it, so every lab
// page stayed missing from the sitemap while the fix looked applied. Reading the registry is also
// free: no database call at all.
import { LAB_REGISTRY } from "@/server/labs/registry";
import { reportError } from "@/server/observability/alerts";

export const dynamic = "force-dynamic";

// The sitemap, as a route handler rather than Next's `sitemap.ts` convention, for one reason:
// CONTROL OVER CACHING OF A DEGRADED RESULT.
//
// The convention file cannot set response headers, so `revalidate = 3600` cached whatever it
// produced — including the stripped-down version generated while the database was unreachable. When
// the database came back the site served real data everywhere, while /sitemap.xml kept returning a
// 26-hour-old cached response listing 20 URLs instead of ~830, with x-vercel-cache: HIT. Google
// would have seen a site that had apparently deleted its entire catalogue.
//
// The rule this encodes: NEVER CACHE A FAILURE. A good response is cached for an hour, because it
// is fetched by exactly the automated clients we least want recomputing the catalog. A degraded one
// is marked no-store so it expires the instant the data returns.
//
// It still degrades rather than 500s — a sitemap that errors means crawlers discover nothing at
// all, and sustained errors on this file are how a site falls out of an index.

const STATIC_PAGES = [
  ["", "weekly", 1.0], ["/market", "daily", 0.9], ["/search", "daily", 0.85],
  ["/compounds", "weekly", 0.8], ["/vendors", "weekly", 0.8], ["/stacks", "weekly", 0.7], ["/research", "weekly", 0.75],
  ["/passports", "daily", 0.8], ["/labs", "weekly", 0.75], ["/testing", "weekly", 0.7],
  ["/compare", "weekly", 0.6], ["/how-we-check", "monthly", 0.7], ["/grades", "monthly", 0.7],
  ["/reference-standard", "monthly", 0.6], ["/signals", "daily", 0.65], ["/verify", "monthly", 0.7],
  ["/enforcement", "daily", 0.7], ["/news", "daily", 0.65], ["/about", "monthly", 0.5],
  ["/help", "monthly", 0.5], ["/status", "daily", 0.4],
  ["/legal/privacy", "yearly", 0.2], ["/legal/terms", "yearly", 0.2],
  ["/legal/disclaimer", "yearly", 0.3], ["/legal/us-regulations", "yearly", 0.3],
  ["/legal/contact", "yearly", 0.3],
] as const;

const xmlEscape = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function urlEntry(path: string, changefreq: string, priority: number, lastmod: string) {
  return `<url><loc>${xmlEscape(siteUrl + path)}</loc><lastmod>${lastmod}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

export async function GET() {
  const catalog = await getCatalogSnapshot().catch((error) => {
    reportError({ kind: "sitemap-degraded", message: "The sitemap could not read the catalog and is serving static routes only. It will NOT be cached in this state.", context: { error: String(error) } });
    return null;
  });
  // Passport and laboratory pages exist and serve, but were absent from the sitemap entirely, so
  // search engines had no way to reach the certificate records this site is built around. Failing
  // to read them degrades to omitting them rather than taking the whole sitemap down.
  const passportSlugs = await listSitemapPassportSlugs().catch(() => [] as string[]);
  const labSlugs = LAB_REGISTRY.map((lab) => lab.slug);
  const lastmod = new Date().toISOString().slice(0, 10);

  const entries = [
    ...STATIC_PAGES.map(([path, freq, pri]) => urlEntry(path, freq, pri, lastmod)),
    ...(catalog?.products ?? []).map((p) => urlEntry(`/products/${p.slug}`, "daily", 0.8, lastmod)),
    ...(catalog?.compounds ?? []).map((c) => urlEntry(`/compounds/${c.slug}`, "weekly", 0.75, lastmod)),
    ...(catalog?.vendors ?? []).map((v) => urlEntry(`/vendors/${v.slug}`, "weekly", 0.7, lastmod)),
    // Only stacks whose components the catalog actually tracks — the page 404s otherwise.
    ...STACKS.filter((s) => catalog && resolveStack(s, catalog.compounds) !== null).map((s) => urlEntry(`/stacks/${s.slug}`, "weekly", 0.65, lastmod)),
    ...passportSlugs.map((slug) => urlEntry(`/passports/${slug}`, "monthly", 0.65, lastmod)),
    ...labSlugs.map((slug) => urlEntry(`/labs/${slug}`, "monthly", 0.5, lastmod)),
  ];

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>`,
    {
      headers: {
        "content-type": "application/xml; charset=utf-8",
        // The whole point: a complete sitemap caches, a degraded one never does.
        "cache-control": catalog
          ? "public, s-maxage=3600, stale-while-revalidate=86400"
          : "no-store, must-revalidate",
      },
    },
  );
}

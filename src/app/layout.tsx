import type { Metadata, Viewport } from "next";
import { DisclosureBanner } from "@/components/disclosure-banner";
import { MarketplaceProvider } from "@/components/marketplace-state";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TrackView } from "@/components/track-view";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
import { JsonLd } from "@/components/json-ld";
import { organizationSchema, webSiteSchema } from "@/lib/structured-data";
import { siteConfig } from "@/lib/site";
import { getCatalogSnapshot } from "@/server/catalog/repository";
import { emptyCatalogLite, toCatalogLite } from "@/lib/catalog-lite";
import { getCurrentPrincipal } from "@/server/auth/principal";
import { getSavedStackSlugs, getWatchlistSlugs } from "@/server/account/repository";
import { getDefaultComparison } from "@/server/consumer-intelligence/repository";
import { MobileRetentionNav } from "@/components/mobile-retention-nav";
import "./globals.css";
import { reportError } from "@/server/observability/alerts";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "VialGrade — Don't get scammed buying peptides",
    template: "%s · VialGrade",
  },
  description: siteConfig.description,
  applicationName: "VialGrade",
  // Proves ownership of the domain to Google Search Console, which is how the ~1,000 URLs in the
  // sitemap get discovered deliberately instead of by chance. Not a secret — it only asserts
  // control of this site — and it must stay put: removing it un-verifies the property and silently
  // cuts off the only place indexing and search performance can be seen.
  verification: { google: "Diid1gTzaORBswpj2aFdIgXw3p2UAAsZPSb1qsKrip8" },
  keywords: ["peptide market", "research products", "vendor comparison", "batch evidence", "market intelligence"],
  openGraph: {
    type: "website",
    title: "VialGrade — Don't get scammed buying peptides",
    description: "Every vendor's price, lab test, and reputation on one screen.",
    siteName: "VialGrade",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "VialGrade marketplace interface" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VialGrade — Don't get scammed buying peptides",
    description: "Every vendor's price, lab test, and reputation on one screen.",
    images: ["/og-image.png"],
  },
  icons: {
    // SVG first so the tab icon stays crisp at every zoom and pixel density; the PNG is the
    // fallback for browsers that still refuse an SVG favicon.
    icon: [
      { url: "/brand/vialgrade-icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f7f4",
  colorScheme: "light",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The layout must NEVER throw. It wraps every route, including pages that need no data at all —
  // /about, /grades, every /legal page — and an error thrown here escapes error.tsx entirely
  // (a boundary does not wrap the layout above it), so it lands on global-error.tsx and takes the
  // WHOLE SITE down. That is exactly what a database outage did: robots.txt kept serving 200
  // because it is prerendered, while every real page returned a server exception.
  //
  // So a failure degrades to an empty catalog instead. Static pages then render normally and only
  // the catalog-dependent chrome goes quiet. Losing the search overlay for a few minutes is a far
  // smaller failure than losing the entire site.
  //
  // It also ships only the LITE projection. The layout is the one place on the site whose props
  // land in EVERY page's HTML, so the full snapshot here meant /about — static prose that renders
  // no catalog data whatsoever — carried ~580 listings with their price histories, evidence
  // dimensions and trust objects, plus every vendor history feed and compound research note. Over
  // a megabyte per view, per crawler hit, to render nothing. src/lib/catalog-lite.ts holds the
  // exact field set the site-wide chrome reads; pages that need whole records (/market,
  // /compounds, /watchlist) load them in their own server component.
  const [catalog, principal] = await Promise.all([
    getCatalogSnapshot().then(toCatalogLite).catch((error) => {
      reportError({ kind: "catalog-unavailable", severity: "critical", message: "The root layout could not read the catalog. Every page is now serving a degraded shell. Usually the database is unreachable.", context: { error: String(error) } });
      return emptyCatalogLite(new Date().toISOString());
    }),
    getCurrentPrincipal().catch(() => null),
  ]);
  const [watchlist, comparison, savedStacks] = principal
    ? await Promise.all([
        getWatchlistSlugs(principal.id).catch(() => []),
        getDefaultComparison(principal.id).catch(() => null),
        getSavedStackSlugs(principal.id).catch(() => []),
      ])
    : [[], null, []];
  // Whether this deployment actually holds any seeded demo records — drives the provenance copy so
  // an all-Live deployment never implies its data might be demo.
  const hasDemo = catalog.products.some((p) => p.origin === "demo") || catalog.vendors.some((v) => v.origin === "demo") || catalog.compounds.some((c) => c.origin === "demo");
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--background)] pb-20 text-[var(--foreground)] antialiased md:pb-0">
        {/* Site-wide identity. Lives in the layout so every page carries the publisher and site
            nodes that per-page schema references by @id, instead of each page redeclaring them. */}
        <JsonLd data={[organizationSchema(), webSiteSchema()]} />
        <MarketplaceProvider catalog={catalog} initialWatchlist={watchlist} initialSavedStacks={savedStacks} initialCompare={comparison?.listingSlugs ?? []} authenticated={Boolean(principal)}>
          <TrackView />
          <DisclosureBanner hasDemo={hasDemo} />
          <SiteHeader authenticated={Boolean(principal)} />
          <main>{children}</main>
          <SiteFooter hasDemo={hasDemo} />
          <MobileRetentionNav authenticated={Boolean(principal)} />
        </MarketplaceProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}

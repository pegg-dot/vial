import type { Metadata, Viewport } from "next";
import { DisclosureBanner } from "@/components/disclosure-banner";
import { MarketplaceProvider } from "@/components/marketplace-state";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
import { siteConfig } from "@/lib/site";
import { getCatalogSnapshot } from "@/server/catalog/repository";
import { getCurrentPrincipal } from "@/server/auth/principal";
import { getWatchlistSlugs } from "@/server/account/repository";
import { getDefaultComparison } from "@/server/consumer-intelligence/repository";
import { MobileRetentionNav } from "@/components/mobile-retention-nav";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "VIAL — Don't get scammed buying peptides",
    template: "%s · VIAL",
  },
  description: siteConfig.description,
  applicationName: "VIAL",
  keywords: ["peptide market", "research products", "vendor comparison", "batch evidence", "market intelligence"],
  openGraph: {
    type: "website",
    title: "VIAL — Don't get scammed buying peptides",
    description: "Every vendor's price, lab test, and reputation on one screen.",
    siteName: "VIAL",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "VIAL marketplace interface" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VIAL — Don't get scammed buying peptides",
    description: "Every vendor's price, lab test, and reputation on one screen.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/icon-192.png",
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
  const [catalog, principal] = await Promise.all([getCatalogSnapshot(), getCurrentPrincipal()]);
  const [watchlist, comparison] = principal ? await Promise.all([getWatchlistSlugs(principal.id), getDefaultComparison(principal.id)]) : [[], null];
  // Whether this deployment actually holds any seeded demo records — drives the provenance copy so
  // an all-Live deployment never implies its data might be demo.
  const hasDemo = catalog.products.some((p) => p.origin === "demo") || catalog.vendors.some((v) => v.origin === "demo") || catalog.compounds.some((c) => c.origin === "demo");
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--background)] pb-20 text-[var(--foreground)] antialiased md:pb-0">
        <MarketplaceProvider catalog={catalog} initialWatchlist={watchlist} initialCompare={comparison?.listingSlugs ?? []} authenticated={Boolean(principal)}>
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

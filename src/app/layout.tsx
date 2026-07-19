import type { Metadata, Viewport } from "next";
import { DisclosureBanner } from "@/components/disclosure-banner";
import { MarketplaceProvider } from "@/components/marketplace-state";
import { CommerceCartProvider } from "@/components/commerce-cart-provider";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
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
    default: "VIAL — The peptide market, made legible",
    template: "%s · VIAL",
  },
  description: siteConfig.description,
  applicationName: "VIAL",
  keywords: ["peptide market", "research products", "vendor comparison", "batch evidence", "market intelligence"],
  openGraph: {
    type: "website",
    title: "VIAL — The peptide market, made legible",
    description: "Compare fictional peptide research listings through a premium evidence-first interface.",
    siteName: "VIAL",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "VIAL marketplace interface" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VIAL — The peptide market, made legible",
    description: "An evidence-first peptide market intelligence prototype.",
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
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--background)] pb-20 text-[var(--foreground)] antialiased md:pb-0">
        <MarketplaceProvider catalog={catalog} initialWatchlist={watchlist} initialCompare={comparison?.listingSlugs ?? []} authenticated={Boolean(principal)}>
          <CommerceCartProvider authenticated={Boolean(principal)}>
            <DisclosureBanner />
            <SiteHeader authenticated={Boolean(principal)} />
            <main>{children}</main>
            <SiteFooter />
            <MobileRetentionNav authenticated={Boolean(principal)} />
          </CommerceCartProvider>
        </MarketplaceProvider>
      </body>
    </html>
  );
}

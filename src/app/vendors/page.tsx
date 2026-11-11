import type { Metadata } from "next";
import { FileCheck2, Factory, Store } from "lucide-react";
import { getVendorDirectory } from "@/server/vendors/directory";
import { getCertificatesOnRecord } from "@/server/public-repository";
import { VendorsDirectory } from "@/components/vendors-directory";
import { DataUnavailable } from "@/components/home-data-unavailable";
import { PageHero, Section, StatRow } from "@/components/intelligence/research-ui";
import { hidesCommerce, hidesMarket } from "@/lib/public-research-release";
import { projectDirectoryEntry, projectMarketDirectoryEntry } from "@/lib/evidence-projection";
import { reportError } from "@/server/observability/alerts";

export const metadata: Metadata = { title: "Vendor directory", description: "Browse historical vendor records, laboratory reports, regulatory source links and the limits of available evidence; not a purchasing recommendation.", alternates: { canonical: "/vendors" } };
export const dynamic = "force-dynamic";

// A directory page: the compact hero puts the first control above the fold, with the masthead
// figures as a plain row under the lead — numbers on the page, not in a box.
export default async function VendorsPage() {
  // Guard BEFORE deriving anything — the counts below read `entries` directly.
  const entries = await getVendorDirectory().catch((error) => { reportError({ kind: "vendors-unavailable", message: "The vendor directory could not be read.", context: { error: String(error) } }); return null; });
  const totalCoa = await getCertificatesOnRecord().catch(() => null);   // site-wide corpus, not the vendor-matched subset
  if (!entries || totalCoa === null) return <DataUnavailable surface="the vendor directory" />;
  const storefronts = entries.filter((e) => e.vendor.kind !== "manufacturer").length;
  const manufacturers = entries.filter((e) => e.vendor.kind === "manufacturer").length;

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      {/* The market crumb carries its #browse hash: the browse release bans any `main` href that
          ends in "/market", and the browse section is where a reader coming back from here lands. */}
      <PageHero size="compact" art={["magnifier", "shield"]}
        breadcrumb={[{ href: "/intelligence", label: "Home" }, { label: "Vendors" }]}
        eyebrow={<><Store className="size-4" aria-hidden="true" /> Vendor directory</>}
        title="Explore vendors through documented evidence."
        lead="Browse documented vendor observations, laboratory sample findings and source histories. Sorting these records does not certify a vendor or recommend purchasing anything.">
        <StatRow className="mt-8" items={[
          { icon: Store, value: storefronts, label: "Storefronts on record" },
          { icon: Factory, value: manufacturers, label: "Upstream manufacturers" },
          { icon: FileCheck2, value: totalCoa, label: "Lab certificates on record" },
        ]} />
      </PageHero>

      <Section tight>
        {/* Evidence-only: no price or listing figures. With the market record released: listing counts
            and the price index, still no buyer sentiment. Legacy: everything. */}
        <VendorsDirectory entries={hidesMarket() ? entries.map(projectDirectoryEntry) : hidesCommerce() ? entries.map(projectMarketDirectoryEntry) : entries}
          hidePrices={hidesMarket()} hideBuyers={hidesCommerce()} />
      </Section>
    </div>
  );
}

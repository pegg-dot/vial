import type { Metadata } from "next";
import { BarChart3, BookOpenText, Layers3 } from "lucide-react";
import { getCatalogSnapshot } from "@/server/catalog/repository";
import { getCertificatesOnRecord } from "@/server/public-repository";
import { SHELVES } from "@/lib/market-taxonomy";
import { CompoundsExperience } from "@/components/market/compounds-experience";
import { DataUnavailable } from "@/components/home-data-unavailable";
import { PageHero, Section, StatRow } from "@/components/intelligence/research-ui";
import { hidesCommerce } from "@/lib/public-research-release";
import { projectCatalog } from "@/lib/evidence-projection";
import { reportError } from "@/server/observability/alerts";

export const metadata: Metadata = { title: "Compound directory", description: "Browse canonical compound records, laboratory-report coverage and evidence context.", alternates: { canonical: "/compounds" } };
export const dynamic = "force-dynamic";

// Map a legacy goal-tag key (?goal=) onto a shelf key so old links keep working.
function shelfKeyFor(goal: string | undefined, shelf: string | undefined): string | null {
  if (shelf && SHELVES.some((s) => s.key === shelf)) return shelf;
  if (!goal) return null;
  const match = SHELVES.find((s) => s.goalKeys.includes(goal));
  return match?.key ?? null;
}

export default async function CompoundsPage({ searchParams }: { searchParams: Promise<{ goal?: string; shelf?: string }> }) {
  const { goal, shelf } = await searchParams;
  // Degrade rather than throw, and never to zeros — "0 compounds tracked" is a claim we cannot
  // stand behind. See home-data-unavailable.tsx for why an honest blank beats a confident wrong.
  const catalog = await getCatalogSnapshot().catch((error) => { reportError({ kind: "compounds-unavailable", message: "The compound directory could not be read.", context: { error: String(error) } }); return null; });
  const totalCoa = await getCertificatesOnRecord().catch(() => null);
  if (!catalog || totalCoa === null) return <DataUnavailable surface="the compound directory" />;
  const { compounds, products } = catalog;
  const initialShelf = shelfKeyFor(goal, shelf);

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      {/* The first crumb lands on the market's catalog anchor: the browse release rejects any
          in-page href that ends in "/market" (the closed per-compound market tables). */}
      <PageHero size="compact" art={["molecule", "vial"]}
        breadcrumb={[{ href: "/intelligence/market", label: "Research Market" }, { label: "Compounds" }]}
        eyebrow={<><Layers3 className="size-4" aria-hidden="true" /> Compound directory</>}
        title="Every peptide we track."
        lead={<>{hidesCommerce() ? "One page per compound with laboratory-report coverage, batch passports and the research on file." : "One page per compound with documented vendor observations, historical price ranges and laboratory-report coverage."} Research topics are indexing labels, not validated health benefits or purchasing recommendations.</>}
      >
        <StatRow className="mt-8" items={[
          { icon: Layers3, value: compounds.length, label: "Records" },
          ...(hidesCommerce() ? [] : [{ icon: BarChart3, value: products.length, label: "Listings" }]),
          { icon: BookOpenText, value: totalCoa, label: "Lab certificates" },
        ]} />
      </PageHero>

      <Section tight>
        <CompoundsExperience catalog={hidesCommerce() ? projectCatalog(catalog) : catalog} initialShelf={initialShelf} hidePrices={hidesCommerce()} />
      </Section>
    </div>
  );
}

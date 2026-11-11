import type { Metadata } from "next";
import { BarChart3, BookOpenText, Layers3 } from "lucide-react";
import { getCatalogSnapshot } from "@/server/catalog/repository";
import { getCertificatesOnRecord } from "@/server/public-repository";
import { SHELVES } from "@/lib/market-taxonomy";
import { CompoundsExperience } from "@/components/market/compounds-experience";
import { DataUnavailable } from "@/components/home-data-unavailable";
import { PageHero, Pill, Section, SectionHeading, StatRow } from "@/components/intelligence/research-ui";
import { evidenceOnlyPublicRelease, hidesCommerce, publicBrowseRelease } from "@/lib/public-research-release";
import { ResearchExplorer } from "@/components/intelligence/research-explorer";
import { ResearchThemeRail } from "@/components/intelligence/research-original-home";
import { ResearchMarketShelves } from "@/components/intelligence/research-market-shelves";
import { parseExplorerState } from "@/lib/research-explorer-state";
import { RESEARCH_SUBJECTS } from "@/lib/research-explorer";
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

export default async function CompoundsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const goal = typeof params.goal === "string" ? params.goal : undefined;
  const shelf = typeof params.shelf === "string" ? params.shelf : undefined;
  // The research library (16 curated files) is public under the evidence-only release whatever the
  // browse release says; the catalog records need the browse release.
  const showCatalog = !evidenceOnlyPublicRelease() || publicBrowseRelease();
  const explorerInitial = parseExplorerState(params);
  const selectedTheme = explorerInitial.theme === "all" ? undefined : explorerInitial.theme;
  // Degrade rather than throw, and never to zeros — "0 compounds tracked" is a claim we cannot
  // stand behind. See home-data-unavailable.tsx for why an honest blank beats a confident wrong.
  const catalog = showCatalog ? await getCatalogSnapshot().catch((error) => { reportError({ kind: "compounds-unavailable", message: "The compound directory could not be read.", context: { error: String(error) } }); return null; }) : null;
  const totalCoa = showCatalog ? await getCertificatesOnRecord().catch(() => null) : null;
  if (showCatalog && (!catalog || totalCoa === null)) return <DataUnavailable surface="the compound directory" />;
  const compounds = catalog?.compounds ?? [];
  const products = catalog?.products ?? [];
  const initialShelf = shelfKeyFor(goal, shelf);

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      {/* The first crumb lands on the market's catalog anchor: the browse release rejects any
          in-page href that ends in "/market" (the closed per-compound market tables). */}
      <PageHero size="compact" art={["molecule", "vial"]}
        breadcrumb={[{ href: "/intelligence", label: "Home" }, { label: "Compounds" }]}
        eyebrow={<><Layers3 className="size-4" aria-hidden="true" /> Compound directory</>}
        title="Every peptide we track."
        lead={<>One page per compound: the curated research file where one exists, {hidesCommerce() ? "laboratory-report coverage, batch passports and the research on file" : "documented vendor observations, historical price ranges and laboratory-report coverage"}. Research topics are indexing labels, not validated health benefits or purchasing recommendations.</>}
        actions={<>
          <Pill href="#browse" variant="primary" arrow="right">Browse the research library</Pill>
          {showCatalog && <Pill href="#catalog" arrow="right">Catalog records</Pill>}
        </>}
      >
        <StatRow className="mt-8" items={[
          { icon: BookOpenText, value: RESEARCH_SUBJECTS.length, label: "Research files" },
          ...(showCatalog ? [{ icon: Layers3, value: compounds.length, label: "Catalog records" }] : []),
          ...(showCatalog && !hidesCommerce() ? [{ icon: BarChart3, value: products.length, label: "Listings" }] : []),
          ...(showCatalog ? [{ icon: BookOpenText, value: totalCoa ?? 0, label: "Lab certificates" }] : []),
        ]} />
      </PageHero>

      {/* ── The research library: the same shelves and explorer the research market had, unchanged. ── */}
      <Section tight>
        <ResearchThemeRail />
        <div className="mt-8"><ResearchMarketShelves /></div>
        <section id="browse" className="scroll-mt-36 pt-12">
          <SectionHeading eyebrow="Every curated subject" title="Browse everything."
            lead="Filter by biology and documented source coverage. This is a reference library, not an inventory."
            action={<Pill href="/how-we-check#grade-checks" arrow="right">Our file checking method</Pill>} className="mb-7" />
          <ResearchExplorer key={selectedTheme || "all"} initial={explorerInitial} />
        </section>
        <p className="mt-12 border-t border-[#111214]/15 pt-6 text-xs font-medium leading-6 text-[var(--muted)]">
          All sixteen cards are dated public research reference files. They do not establish clinical effectiveness, a tested physical lot, a scientific consensus or purchase eligibility.
        </p>
      </Section>

      {/* ── Catalog records: every compound with lab evidence, batch records or published research on file. ── */}
      {showCatalog && catalog && (
        <Section id="catalog" band="white">
          <SectionHeading eyebrow="Catalog records" title="Every catalog record."
            lead="Compounds with independent certificates, batch records or published research on file, by research shelf. The same page shows a compound's research file when it has one." className="mb-6" />
          <CompoundsExperience catalog={hidesCommerce() ? projectCatalog(catalog) : catalog} initialShelf={initialShelf} hidePrices={hidesCommerce()} />
        </Section>
      )}
    </div>
  );
}

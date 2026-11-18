import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { FileSearch, FlaskConical, Layers3, Store } from "lucide-react";
import { CATALOG_CACHE_TAG, getCompoundBySlug, getProductsByCompoundSlug } from "@/server/catalog/repository";
import { getLabTestsForCompound } from "@/server/ingest/lab-tests";
import { getVendorDirectory } from "@/server/vendors/directory";
import { getDatabase } from "@/server/db/client";
import { comparisonHref, hidesMarket } from "@/lib/public-research-release";
import { buildSourceComparison, comparisonSort, pickSources, sortSources } from "@/lib/source-comparison";
import { VendorComparisonTable, VendorSideBySide } from "@/components/vendor-comparison";
import { ResearchScopeNotice } from "@/components/research-scope-notice";
import { NumberedSection, PageFootnote, PageHero, Pill, Section, StatRow, UI } from "@/components/intelligence/research-ui";

export const dynamic = "force-dynamic";

// Every report on record for the compound, not the compound page's first twenty: a comparison
// that silently stops at a limit would show a source as untested because its report was row 21.
const REPORT_LIMIT = 1000;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const compound = await getCompoundBySlug(slug);
  if (!compound) return {};
  return {
    title: `${compound.name}: vendor comparison | VialGrade`,
    description: `Every source of ${compound.name} on record, set side by side: what each lists, the price as last read, and what an independent lab reported for a sample attributed to it.`,
    alternates: { canonical: comparisonHref(slug) },
  };
}

// Identical for every visitor, so it is loaded once and cached under the catalog tag the collect
// cron invalidates. Only the two vendor fields the page needs leave the directory.
const loadComparisonData = unstable_cache(
  async (slug: string) => {
    const [listings, labTests, directory] = await Promise.all([
      getProductsByCompoundSlug(slug),
      getDatabase().then((db) => getLabTestsForCompound(db, slug, REPORT_LIMIT)),
      getVendorDirectory().catch(() => []),
    ]);
    return { listings, labTests, vendors: directory.map((e) => ({ slug: e.vendor.slug, name: e.vendor.name, websiteUrl: e.websiteUrl })) };
  },
  ["compound-vendor-comparison"],
  { tags: [CATALOG_CACHE_TAG], revalidate: 21600 },
);

/**
 * The vendor comparison for one compound: the room the compound page's two tables (listings, lab
 * reports) cannot be, because a reader there cannot set one source beside another. One row per
 * source, then any two side by side. Its own route so a comparison can be linked and saved.
 *
 * Released with the market record (hidesMarket): it is made of the same prices and listings.
 */
export default async function CompoundVendorComparisonPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (hidesMarket()) notFound();
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const compound = await getCompoundBySlug(slug);
  if (!compound) notFound();

  const { listings, labTests, vendors } = await loadComparisonData(slug);
  const comparison = buildSourceComparison(listings, labTests, new Map(vendors.map((v) => [v.slug, v.name])));
  const websiteByVendor = new Map(vendors.map((v) => [v.slug, v.websiteUrl]));
  const sort = comparisonSort(query.sort);
  const sources = sortSources(comparison.sources, sort);
  const picked = pickSources(sources, query.a, query.b);
  const base = comparisonHref(slug);

  const listed = sources.filter((s) => s.listings.length > 0).length;
  const reported = sources.filter((s) => s.independentReports > 0).length;
  const both = sources.filter((s) => s.listings.length > 0 && s.independentReports > 0).length;
  const name = compound.name;

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      <PageHero size="compact" art={["flask"]}
        breadcrumb={[{ href: "/intelligence", label: "Home" }, { href: "/compounds", label: "Compounds" }, { href: `/compounds/${slug}`, label: name }, { label: "Vendor comparison" }]}
        eyebrow="Comparative record"
        title={<>{name}, vendor by vendor</>}
        lead={sources.length === 0
          ? `No source of ${name} is on record yet: no listing has been read and no lab report names one.`
          : `Every source of ${name} on record, one row each: what it lists, the price as last read, and what an independent lab reported for a sample attributed to it. Set any two side by side.`}
        note="A comparison of records, not a ranking. VialGrade sells nothing and takes no referrals, and nothing here says which source to choose."
        actions={<Pill href={`/compounds/${slug}`} variant="ghost" icon={FileSearch}>Back to the {name} record</Pill>}
      >
        {sources.length > 0 && (
          <StatRow className="mt-8" items={[
            { icon: Layers3, value: sources.length, label: "Sources on record" },
            { icon: Store, value: listed, label: "With a listing read" },
            { icon: FlaskConical, value: reported, label: "With an independent lab report" },
            { value: both, label: "With both" },
          ]} />
        )}
      </PageHero>

      <Section tight className="grid min-w-0 gap-4">
        {sources.length === 0 ? (
          <div className="ink hard-sm rounded-[16px] bg-white px-6 py-14 text-center">
            <p className="text-lg font-extrabold">Nothing to compare for {name} yet.</p>
            <p className={UI.body + " mx-auto mt-2 max-w-md"}>We track this compound but hold no listing and no lab report that names a source. That is a gap in our coverage, not a statement about the compound.</p>
          </div>
        ) : (
          <>
            <NumberedSection id="sources" number={1} eyebrow="Every source" flush
              title={`${name} sources, one row each`}
              intro={<>A price is the lowest observed for that source, divided by the listed quantity, with the day it was read. Purity and content come from independent lab reports only; a source&rsquo;s own certificate is counted separately.{both === 0 ? ` No source of ${name} has both a listing and an independent report on record, so price and lab result cannot yet be read off one row.` : ""}</>}>
              <VendorComparisonTable sources={sources} sort={sort} picked={picked.map((s) => s.key)} base={base} />
            </NumberedSection>

            <NumberedSection id="side-by-side" number={2} eyebrow="Side by side"
              title={picked.length === 2 ? `${picked[0].name} and ${picked[1].name}` : `Set two ${name} sources side by side`}
              intro="Every listing and every lab report on record for each source chosen, in full.">
              <VendorSideBySide compoundName={name} sources={sources} picked={picked} sort={sort} base={base} websiteByVendor={websiteByVendor} />
            </NumberedSection>

            <NumberedSection id="limits" number={3} eyebrow="Limits" title="What this comparison can and cannot show">
              <ul className="grid gap-2 text-sm font-medium leading-6 text-[#3a3d46] sm:grid-cols-2">
                <li><span className="font-extrabold text-[#111214]">A lab report is one sample.</span> It describes the vial that was submitted on that date. It does not establish what a later batch or shipment contains.</li>
                <li><span className="font-extrabold text-[#111214]">A price is a dated reading.</span> It is what the source&rsquo;s own page showed on the day shown, not an offer and not a current price.</li>
                <li><span className="font-extrabold text-[#111214]">Attribution follows the report.</span> A report is filed under the source it names. Where that name matches no vendor record, the row carries the name as printed and no link.</li>
                <li><span className="font-extrabold text-[#111214]">A gap is not a finding.</span> &ldquo;None on record&rdquo; means we hold no such record, not that no listing or report exists{comparison.unattributedReports > 0 ? `. ${comparison.unattributedReports} further ${comparison.unattributedReports === 1 ? "report names" : "reports name"} no source and ${comparison.unattributedReports === 1 ? "is" : "are"} left out of the rows` : ""}.</li>
              </ul>
            </NumberedSection>
          </>
        )}
        <ResearchScopeNotice bare />
      </Section>

      <PageFootnote href="/how-we-check" linkLabel="How records are gathered and checked">
        Prices are historical third-party observations and lab figures are read from the reports themselves. Neither is a recommendation, an assurance of identity, safety or lawful sale, or a statement about any product a reader might receive.
      </PageFootnote>
    </div>
  );
}

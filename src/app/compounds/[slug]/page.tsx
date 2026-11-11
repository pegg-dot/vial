import type { Metadata } from "next";
import { ResearchScopeNotice } from "@/components/research-scope-notice";
import { notFound, redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { CATALOG_CACHE_TAG } from "@/server/catalog/repository";
import Link from "next/link";
import { BookOpen, ChartNoAxesCombined, CircleAlert, FileSearch, Layers3 } from "lucide-react";
import { getCompoundBySlug, getProductsByCompoundSlug } from "@/server/catalog/repository";
import { PURITY_PROVENANCE_SHORT } from "@/lib/provenance-copy";
import { formatCurrency } from "@/lib/format";
import { educationFor } from "@/lib/compound-education";
import { depthFor } from "@/lib/compound-depth";
import { GoalTags } from "@/components/goal-tags";
import { CompoundKnowledge } from "@/components/compound-knowledge";
import { UsLegalNotice } from "@/components/us-legal-notice";
import { PriceSeries } from "@/components/price-series";
import { hidesCommerce } from "@/lib/public-research-release";
import { researchSubjectBySlug } from "@/lib/research-explorer";
import { describeCompoundBasis, formatPct } from "@/lib/price-trend";
import { getCompoundDailyMedianSeries } from "@/server/ingest/price-history";
import { FollowButton } from "@/components/follow-button";
import { DataOriginBadge } from "@/components/data-origin-badge";
import { LabTestsPanel } from "@/components/lab-tests-panel";
import { PassportCarousel, type PassportRow } from "@/components/passport-carousel";
import { listPublicPassportsForCompound } from "@/server/evidence-network/repository";
import { PriceLeaderboard } from "@/components/price-leaderboard";
import { SectionNav } from "@/components/section-nav";
import { getLabTestsForCompound } from "@/server/ingest/lab-tests";
import { getDatabase } from "@/server/db/client";
import { getCurrentPrincipal } from "@/server/auth/principal";
import { listFollows } from "@/server/consumer-intelligence/repository";
import { getCompoundResearch, getCompoundRegulatory } from "@/server/external/repository";
import { CompoundResearchPanel } from "@/components/compound-research-panel";
import { InnovatorNote } from "@/components/innovator-note";
import { JsonLd } from "@/components/json-ld";
import { compoundSchema } from "@/lib/structured-data";
import { stacksContaining } from "@/lib/stacks";
import { Chip, Frame, Notice, NumberedSection, PageHero, Pill, Section, SectionHeading, Stat, UI } from "@/components/intelligence/research-ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const compound = await getCompoundBySlug(slug);
  if (!compound) return {};
  return {
    title: `${compound.name} evidence record | VialGrade`,
    description: `Independent lab tests, batch passports, published research and regulatory context on record for ${compound.name}.`,
    alternates: { canonical: `/compounds/${slug}` },
  };
}


// The public half of this page — listings, lab tests, literature, regulatory status, passports.
// Identical for every visitor, so it is loaded once and cached under the shared "catalog" tag that
// the collect cron invalidates on write. getCurrentPrincipal() stays outside: it reads a cookie,
// and caching anything derived from it would leak one visitor's session state to another.
const loadCompoundPublicData = unstable_cache(
  async (slug: string) => {
    const [listings, labTests, research, regulatory, allPassports, medianSeries] = await Promise.all([getProductsByCompoundSlug(slug), getDatabase().then((db) => getLabTestsForCompound(db, slug)), getDatabase().then((db) => getCompoundResearch(slug, db)), getDatabase().then((db) => getCompoundRegulatory(slug, db)), listPublicPassportsForCompound(slug, 12), getDatabase().then((db) => getCompoundDailyMedianSeries(db, slug))]);
    return { listings, labTests, research, regulatory, allPassports, medianSeries };
  },
  ["compound-page"],
  { tags: [CATALOG_CACHE_TAG], revalidate: 21600 },
);

export default async function CompoundPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const compound = await getCompoundBySlug(slug);
  if (!compound) {
    // A compound with a research dossier but no catalog row still has somewhere to go.
    if (hidesCommerce() && researchSubjectBySlug(slug)) redirect("/intelligence/explore/" + slug);
    notFound();
  }
  const [publicData, principal] = await Promise.all([loadCompoundPublicData(slug), getCurrentPrincipal()]);
  const { listings, labTests, research, regulatory, allPassports, medianSeries } = publicData;
  const passports = allPassports as unknown as PassportRow[];
  // Under the evidence-only release this page is for looking into a compound: lab evidence, passports,
  // research. No prices, listings, market table or follow button.
  const noCommerce = hidesCommerce();
  const edu = educationFor(slug);
  // "Commonly stacked with" = the bundles surface. Resolve each stacked slug to a real compound
  // (so we only ever link to compounds we actually track) and carry its cheapest listing price.
  const stacked = edu?.stackedWith?.length
    ? (await Promise.all(edu.stackedWith.map((s) => getCompoundBySlug(s)))).filter((c): c is NonNullable<typeof c> => Boolean(c))
    : [];
  const inStacks = stacksContaining(slug);
  const follows = principal ? await listFollows(principal.id) : [];
  const followed = follows.some((item) => item.entityType === "compound" && item.entitySlug === slug);
  // The hero chart is the DAILY in-stock median across listings, dated — not the old
  // position-by-position average of undated arrays, which averaged different listings' Nth checks
  // as if they were the same day. The pill is earned or absent (D6).
  const medianPoints = medianSeries.map((p) => ({ day: p.day, price: p.median, available: true }));
  const basisCopy = describeCompoundBasis(compound.priceChangeBasis);
  const earned = compound.priceChangeBasis?.medianPct != null;

  // The sticky in-page map — only sections that actually render get a stop. This, the bounded
  // tables, and the single market surface are the "people get lost on this page" fix: one
  // navigable page instead of twelve unbounded stacked sections. Batch passports are lab evidence
  // too, so they share the lab-tests frame and its stop.
  const navItems = [
    ...(edu ? [{ id: "understand", label: "Understand" }] : []),
    ...(listings.length && !noCommerce ? [{ id: "market", label: "The market" }] : []),
    ...(labTests.length || passports.length ? [{ id: "lab-tests", label: "Lab tests" }] : []),
    ...(research.length || regulatory ? [{ id: "research", label: "Research" }] : []),
    ...(stacked.length || inStacks.length ? [{ id: "stacked", label: "Stacked with" }] : []),
  ];
  // Frames are numbered in the order they appear, so a page without an Understand card still starts at 01.
  const sectionNumber = (id: string) => navItems.findIndex((item) => item.id === id) + 1;

  const evidenceCard = (
    <Frame shadow="lg" radius="rounded-[22px]" pad="lg">
      <p className={UI.eyebrowMuted}>Independent lab evidence on record</p>
      <p className="mt-1.5 text-5xl font-extrabold tabular-nums tracking-[-.055em] text-[#111214]">{compound.coaCount}</p>
      <p className="mt-1 text-xs font-bold text-[var(--muted)]">
        {compound.coaCount === 1 ? "certificate" : "certificates"}{compound.medianPurity != null ? " · median reported purity " + compound.medianPurity.toFixed(1) + "%" : ""} · {passports.length} batch {passports.length === 1 ? "passport" : "passports"}
      </p>
      <p className="mt-4 text-[11px] font-medium leading-4 text-[var(--muted)]">{PURITY_PROVENANCE_SHORT} Purity is a lab&rsquo;s figure for one sample, not a grade of the compound or of any seller. <Link href="/grades" className="font-extrabold text-[#2b31d8] hover:underline">How grades work</Link></p>
    </Frame>
  );
  const priceCard = (
    <Frame shadow="lg" radius="rounded-[22px]" pad="lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={UI.eyebrowMuted}>Observed median price</p>
          {/* A compound with no listings has no observed price. Rendering the stored 0.00
              unguarded published "$0.00" as though it were a real market observation on
              liraglutide and pentadeca-arginate — a missing value dressed as a number,
              which is the exact failure this site exists to catch. The market table and the
              sidebar in this same file already guard it; the hero did not. */}
          <p className="mt-1.5 text-5xl font-extrabold tabular-nums tracking-[-.055em] text-[#111214]">
            {compound.medianPrice > 0 ? formatCurrency(compound.medianPrice) : "—"}
          </p>
          {compound.medianPrice > 0 ? null : (
            <p className="mt-1 text-xs font-bold text-[var(--muted)]">No listings on record, so there is no observed price.</p>
          )}
        </div>
        <span title={basisCopy}><Chip plain tone={earned ? "white" : "paper"} className="tabular-nums">{earned ? `${formatPct(compound.priceChangeBasis!.medianPct!)} · 30d` : "Δ —"}</Chip></span>
      </div>
      <div className="mt-5 h-28"><PriceSeries points={medianPoints} description={basisCopy} accent={compound.accent[0]} height={94} compact /></div>
      <p className="mt-3 text-[11px] font-medium leading-4 text-[var(--muted)]">{basisCopy}</p>
    </Frame>
  );

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      {/* A reference entry in the compound directory — name, aliases, description, all visible
          above. Deliberately DefinedTerm and not schema.org/Drug: Drug is a medical entity, and
          asserting one for a grey-market research peptide would claim a standing no evidence on
          this page supports. */}
      <JsonLd data={compoundSchema({ slug, name: compound.name, description: compound.description, aliases: compound.aliases, category: compound.category })} />

      {/* The first crumb lands on the market's catalog anchor: the browse release rejects any
          in-page href that ends in "/market" (the closed per-compound market tables). */}
      <PageHero art={["molecule", "flask"]}
        breadcrumb={[{ href: "/intelligence/market", label: "Research Market" }, { href: "/compounds", label: "Compounds" }, { label: compound.name }]}
        eyebrow={<><Chip tone="blue">{compound.category}</Chip>{compound.origin === "live" && <DataOriginBadge origin="live" />}</>}
        title={compound.name}
        /* Plain words first. The scientific one-liner ("a synthetic pentadecapeptide…") told a
           first-time visitor nothing — it now lives with the rest of the science inside the
           Understand frame, and the hero says what this IS in English. */
        lead={edu?.summary ?? compound.description}
        aside={noCommerce ? evidenceCard : priceCard}
      >
        {edu?.goals?.length ? <div className="mt-5"><GoalTags goals={edu.goals} size="md" /></div> : null}
        <div className="mt-5 flex flex-wrap gap-2">
          {compound.aliases.map((alias) => <Chip key={alias} plain>{alias}</Chip>)}
        </div>
        {noCommerce ? null : <div className="mt-6"><FollowButton entityType="compound" entitySlug={slug} entityName={compound.name} initialFollowed={followed} /></div>}
      </PageHero>

      <SectionNav items={navItems} />

      <Section tight>
        <div className="grid gap-4">
          <ResearchScopeNotice bare />

          <div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {noCommerce ? <Stat icon={Layers3} label="Batch passports" value={passports.length} /> : <Stat icon={Layers3} label="Active listings" value={compound.listings} />}
              <Stat icon={FileSearch} label="Independent lab tests" value={compound.medianPurity != null ? `${compound.coaCount} · ${compound.medianPurity.toFixed(1)}%` : compound.coaCount} />
              {noCommerce ? <Stat icon={ChartNoAxesCombined} label="Research findings on file" value={research.length} /> : <Stat icon={ChartNoAxesCombined} label="Observed price range" value={listings.length ? `${formatCurrency(Math.min(...listings.map((item) => item.price)))}–${formatCurrency(Math.max(...listings.map((item) => item.price)))}` : "No active listings"} />}
              <Stat icon={BookOpen} label="Known aliases" value={compound.aliases.length + 1} />
            </div>
            {compound.medianPurity != null && <p className="mt-3 text-[11px] font-medium leading-4 text-[var(--muted)]">{PURITY_PROVENANCE_SHORT} <Link href="/grades" className="font-extrabold text-[#2b31d8] hover:underline">Purity vs grade</Link></p>}
          </div>

          {edu ? (
            <CompoundKnowledge id="understand" number={sectionNumber("understand")} name={compound.name} education={edu} depth={depthFor(slug)} showStacks={false} />
          ) : null}

          {/* THE market surface — marketplace first, science after. Top picks answer "which one?"
              four ways; the leaderboard below ranks everything by real cost. The old page rendered
              the same ~48 listings TWICE (a 49-row table AND a 48-card grid) — one surface now.
              The leaderboard brings its own page container, so this block steps out of the
              section's padding to line up with it. */}
          {listings.length && !noCommerce ? (
            <div id="market" className="-mx-5 scroll-mt-36 sm:-mx-8">
              <div className={UI.container + " pt-2"}>
                <SectionHeading eyebrow="Current market" title={`The ${compound.name} market`}
                  lead={<>Every {compound.name} listing we track &mdash; {listings.length} in all. Historical prices are shown with evidence and data quality limitations. Prices do not amount to a recommendation or an assurance of product identity, safety or lawful sale.</>}
                  /* The way out of the summary. Picks answer "which one?"; the full market answers
                     "show me everything, my way" — sorted by real value, tested purity, how recently
                     we read the store. */
                  action={<Pill href={`/compounds/${slug}/market`} variant="ink" arrow="right">Open full market</Pill>} />
              </div>
              <PriceLeaderboard compoundName={compound.name} marketHref={`/compounds/${slug}/market`} listings={listings} labTests={labTests} />
            </div>
          ) : null}

          {labTests.length || passports.length ? (
            <LabTestsPanel id="lab-tests" number={sectionNumber("lab-tests")} tests={labTests} heading={`${compound.name} — independent lab tests`}>
              {passports.length ? <PassportCarousel passports={passports} compoundName={compound.name} /> : null}
            </LabTestsPanel>
          ) : null}

          <CompoundResearchPanel id="research" number={sectionNumber("research")} findings={research} regulatoryStatus={regulatory?.regulatory_status ?? null} evidenceSummary={regulatory?.evidence_summary ?? null} compoundName={compound.name} fdaApprovedDrugExists={regulatory?.fda_approved_drug_exists ?? null} />

          <InnovatorNote slug={slug} compoundName={compound.name} />

          {stacked.length || inStacks.length ? (
            <NumberedSection id="stacked" number={sectionNumber("stacked")} eyebrow="Commonly researched together" title={`Often stacked with ${compound.name}`}
              intro={`Compounds the research community frequently discusses alongside ${compound.name}. Not a protocol or a recommendation — a starting point for what to read about next.`}
              chips={inStacks.length ? (
                <>
                  <span className={UI.eyebrowMuted + " self-center"}>Part of</span>
                  {/* The stack pages are closed under the evidence-only release, so the names stay
                      as plain chips there; the legacy site keeps the links. */}
                  {inStacks.map((s) => noCommerce
                    ? <Chip key={s.slug} plain>{s.name} <span className="font-bold text-[var(--muted)]">· {s.kind}</span></Chip>
                    : <Link key={s.slug} href={`/stacks/${s.slug}`} className="ink-1 inline-flex min-h-7 items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-extrabold text-[#111214] transition-colors hover:bg-[#eef0ff]">{s.name} <span className="font-bold text-[var(--muted)]">· {s.kind}</span></Link>)}
                </>
              ) : undefined}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {stacked.map((c) => {
                  const cEdu = educationFor(c.slug);
                  return (
                    <Link key={c.slug} href={`/compounds/${c.slug}`} className="ink hard-sm press group flex flex-col gap-3 rounded-[18px] bg-white p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-extrabold tracking-[-.03em] text-[#111214]">{c.name}</p>
                          <p className="mt-0.5 text-xs font-bold text-[var(--muted)]">{c.category}</p>
                        </div>
                        {noCommerce ? null : <span className="shrink-0 text-right text-sm font-extrabold tabular-nums text-[#111214]">{c.listings > 0 ? formatCurrency(c.medianPrice) : "—"}<span className="mt-0.5 block text-[10px] font-bold text-[var(--muted)]">{c.listings > 0 ? "median" : "no listings"}</span></span>}
                      </div>
                      {cEdu?.goals?.length ? <GoalTags goals={cEdu.goals} limit={2} /> : null}
                      {cEdu?.summary ? <p className="line-clamp-2 text-xs font-medium leading-5 text-[#4a4d56]">{cEdu.summary}</p> : null}
                    </Link>
                  );
                })}
              </div>
            </NumberedSection>
          ) : null}

          <UsLegalNotice slug={slug} />

          <Notice tone="warn" icon={CircleAlert}>
            <h2 className={UI.h4}>Research notes aren&rsquo;t product proof</h2>
            <p className="mt-1 max-w-3xl">{compound.researchNote}</p>
          </Notice>
        </div>
      </Section>
    </div>
  );
}

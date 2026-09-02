import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { CATALOG_CACHE_TAG } from "@/server/catalog/repository";
import Link from "next/link";
import { ArrowLeft, BookOpen, ChartNoAxesCombined, CircleAlert, FileSearch, Layers3 } from "lucide-react";
import { ArtMolecule, ArtDroplet } from "@/components/vial-art";
import { getCompoundBySlug, getProductsByCompoundSlug } from "@/server/catalog/repository";
import { PURITY_PROVENANCE_SHORT } from "@/lib/provenance-copy";
import { formatCurrency } from "@/lib/format";
import { educationFor } from "@/lib/compound-education";
import { depthFor } from "@/lib/compound-depth";
import { GoalTags } from "@/components/goal-tags";
import { CompoundKnowledge } from "@/components/compound-knowledge";
import { UsLegalNotice } from "@/components/us-legal-notice";
import { PriceSeries } from "@/components/price-series";
import { describeCompoundBasis, formatPct } from "@/lib/price-trend";
import { getCompoundDailyMedianSeries } from "@/server/ingest/price-history";
import { FollowButton } from "@/components/follow-button";
import { DataOriginBadge } from "@/components/data-origin-badge";
import { LabTestsPanel } from "@/components/lab-tests-panel";
import { PassportCarousel, type PassportRow } from "@/components/passport-carousel";
import { listPublicPassportsForCompound } from "@/server/evidence-network/repository";
import { PriceLeaderboard } from "@/components/price-leaderboard";
import { TopPicks } from "@/components/top-picks";
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

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const compound = await getCompoundBySlug(slug);
  if (!compound) return {};
  return {
    title: `${compound.name} market`,
    description: `Compare ${compound.name} research listings, price history, and documentation coverage.`,
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
  if (!compound) notFound();
  const [publicData, principal] = await Promise.all([loadCompoundPublicData(slug), getCurrentPrincipal()]);
  const { listings, labTests, research, regulatory, allPassports, medianSeries } = publicData;
  const passports = allPassports as unknown as PassportRow[];
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
  // navigable page instead of twelve unbounded stacked sections.
  const navItems = [
    ...(edu ? [{ id: "understand", label: "Understand" }] : []),
    ...(listings.length ? [{ id: "market", label: "The market" }] : []),
    ...(labTests.length ? [{ id: "lab-tests", label: "Lab tests" }] : []),
    ...(research.length || regulatory ? [{ id: "research", label: "Research" }] : []),
    ...(stacked.length || inStacks.length ? [{ id: "stacked", label: "Stacked with" }] : []),
  ];

  return (
    <>
      {/* A reference entry in the compound directory — name, aliases, description, all visible
          above. Deliberately DefinedTerm and not schema.org/Drug: Drug is a medical entity, and
          asserting one for a grey-market research peptide would claim a standing no evidence on
          this page supports. */}
      <JsonLd data={compoundSchema({ slug, name: compound.name, description: compound.description, aliases: compound.aliases, category: compound.category })} />

      <section className="relative isolate overflow-hidden border-b-2 border-[#111214] bg-[#f0edff]">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <ArtMolecule className="gum-float absolute right-[40%] top-[8%] hidden w-16 drop-shadow-[4px_4px_0_#111214] xl:block" a="#6d5dfc" b="#8fffd6" c="#fff" />
          <ArtDroplet className="gum-float-rev absolute right-[3%] bottom-[10%] hidden w-11 drop-shadow-[3px_3px_0_#111214] lg:block" fill="#6d5dfc" />
        </div>
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8 sm:py-14">
          <Link href="/compounds" className="inline-flex items-center gap-2 text-sm font-bold text-[#111214]/60 transition hover:text-[#111214]"><ArrowLeft className="size-4" /> All compounds</Link>
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="ink-1 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.1em] text-[#111214]">
                  <span className="size-2 rounded-full" style={{ background: compound.accent[0] }} /> {compound.category}
                </div>
                {compound.origin === "live" && <DataOriginBadge origin="live" />}
              </div>
              <h1 className="mt-5 text-balance text-[clamp(3.2rem,8vw,7rem)] font-extrabold leading-[.86] tracking-[-.06em]">{compound.name}</h1>
              {edu?.goals?.length ? <div className="mt-5"><GoalTags goals={edu.goals} size="md" /></div> : null}
              {/* Plain words first. The scientific one-liner ("a synthetic pentadecapeptide…")
                  told a first-time visitor nothing — it now lives with the rest of the science
                  inside the Understand card, and the hero says what this IS in English. */}
              <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-[#111214]/70">{edu?.summary ?? compound.description}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {compound.aliases.map((alias) => <span key={alias} className="ink-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#111214]/70">{alias}</span>)}
              </div>
              <div className="mt-6"><FollowButton entityType="compound" entitySlug={slug} entityName={compound.name} initialFollowed={followed} /></div>
            </div>
            <div className="ink hard-lg rounded-[22px] bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">Observed median price</p>
                  {/* A compound with no listings has no observed price. Rendering the stored 0.00
                      unguarded published "$0.00" as though it were a real market observation on
                      liraglutide and pentadeca-arginate — a missing value dressed as a number,
                      which is the exact failure this site exists to catch. The market table and the
                      sidebar in this same file already guard it; the hero did not. */}
                  <p className="mt-1.5 text-5xl font-extrabold tracking-[-.055em]">
                    {compound.medianPrice > 0 ? formatCurrency(compound.medianPrice) : "—"}
                  </p>
                  {compound.medianPrice > 0 ? null : (
                    <p className="mt-1 text-xs font-semibold text-[var(--muted)]">No listings on record, so there is no observed price.</p>
                  )}
                </div>
                <span className={`ink-1 rounded-full px-2.5 py-1 text-xs font-extrabold tabular-nums ${earned ? "bg-white text-[#111214]" : "bg-white text-[var(--muted)]"}`} title={basisCopy}>{earned ? `${formatPct(compound.priceChangeBasis!.medianPct!)} · 30d` : "Δ —"}</span>
              </div>
              <div className="mt-5 h-28"><PriceSeries points={medianPoints} description={basisCopy} accent={compound.accent[0]} height={94} compact /></div>
              <p className="mt-3 text-[11px] leading-4 text-black/60">{basisCopy}</p>
            </div>
          </div>
        </div>
      </section>

      <SectionNav items={navItems} />

      <section className="mx-auto max-w-[1320px] px-5 py-14 sm:px-8 sm:py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={Layers3} label="Active listings" value={String(compound.listings)} />
          <Stat icon={FileSearch} label="Independent lab tests" value={compound.medianPurity != null ? `${compound.coaCount} · ${compound.medianPurity.toFixed(1)}%` : String(compound.coaCount)} />
          <Stat icon={ChartNoAxesCombined} label="Observed price range" value={listings.length ? `${formatCurrency(Math.min(...listings.map((item) => item.price)))}–${formatCurrency(Math.max(...listings.map((item) => item.price)))}` : "No active listings"} />
          <Stat icon={BookOpen} label="Known aliases" value={String(compound.aliases.length + 1)} />
        </div>
        {compound.medianPurity != null && <p className="mt-3 text-[11px] font-medium leading-4 text-[var(--muted)]">{PURITY_PROVENANCE_SHORT} <Link href="/grades" className="font-bold text-[#2b31d8] underline underline-offset-2">Purity vs grade</Link></p>}
      </section>

      {edu ? (
        <section id="understand" className="mx-auto max-w-[1320px] scroll-mt-[140px] px-5 pb-4 sm:px-8">
          <CompoundKnowledge name={compound.name} education={edu} depth={depthFor(slug)} showStacks={false} />
        </section>
      ) : null}

      {/* THE market surface — marketplace first, science after. Top picks answer "which one?"
          four ways; the leaderboard below ranks everything by real cost. The old page rendered
          the same ~48 listings TWICE (a 49-row table AND a 48-card grid) — one surface now. */}
      {listings.length ? (
        <div id="market" className="scroll-mt-[140px]">
          <section className="mx-auto max-w-[1320px] px-5 pt-6 sm:px-8">
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#5a4be0]">Current market</p>
            <h2 className="mt-3 text-[clamp(1.8rem,3.6vw,2.6rem)] font-extrabold leading-[.98] tracking-[-.04em]">The {compound.name} market</h2>
            <p className="mb-7 mt-3 max-w-2xl text-sm font-medium leading-6 text-[var(--muted)]">All {listings.length} listings we track, ranked by what a milligram really costs — with the standout picks first where the evidence supports them.</p>
            <TopPicks listings={listings} labTests={labTests} />
          </section>
          <PriceLeaderboard compoundName={compound.name} listings={listings} labTests={labTests} />
        </div>
      ) : null}

      <LabTestsPanel id="lab-tests" tests={labTests} heading={`${compound.name} — independent lab tests`} />

      <PassportCarousel passports={passports} compoundName={compound.name} />

      <CompoundResearchPanel id="research" findings={research} regulatoryStatus={regulatory?.regulatory_status ?? null} evidenceSummary={regulatory?.evidence_summary ?? null} compoundName={compound.name} fdaApprovedDrugExists={regulatory?.fda_approved_drug_exists ?? null} />

      <section className="mx-auto max-w-[1320px] px-5 pb-4 sm:px-8">
        <InnovatorNote slug={slug} compoundName={compound.name} />
      </section>

      {stacked.length || inStacks.length ? (
        <section id="stacked" className="mx-auto max-w-[1320px] scroll-mt-[140px] px-5 pb-4 sm:px-8">
          <div className="mb-7">
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#5a4be0]">Commonly researched together</p>
            <h2 className="mt-3 text-[clamp(1.8rem,3.6vw,2.6rem)] font-extrabold leading-[.98] tracking-[-.04em]">Often stacked with {compound.name}</h2>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[var(--muted)]">Compounds the research community frequently discusses alongside {compound.name}. Not a protocol or a recommendation — a starting point for what to read about next.</p>
            {inStacks.length ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">Part of</span>
                {inStacks.map((s) => (
                  <Link key={s.slug} href={`/stacks/${s.slug}`} className="ink-1 hard-sm press inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-bold">
                    {s.name} <span className="font-semibold text-[var(--muted)]">· {s.kind}</span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stacked.map((c) => {
              const cEdu = educationFor(c.slug);
              return (
                <Link key={c.slug} href={`/compounds/${c.slug}`} className="ink-1 hard press group flex flex-col gap-3 rounded-[18px] bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-extrabold tracking-[-.03em]">{c.name}</p>
                      <p className="mt-0.5 text-xs font-semibold text-[var(--muted)]">{c.category}</p>
                    </div>
                    <span className="shrink-0 text-right text-sm font-extrabold tabular-nums">{c.listings > 0 ? formatCurrency(c.medianPrice) : "—"}<span className="mt-0.5 block text-[10px] font-semibold text-[var(--muted)]">{c.listings > 0 ? "median" : "no listings"}</span></span>
                  </div>
                  {cEdu?.goals?.length ? <GoalTags goals={cEdu.goals} limit={2} /> : null}
                  {cEdu?.summary ? <p className="line-clamp-2 text-xs font-medium leading-5 text-black/60">{cEdu.summary}</p> : null}
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-[1320px] px-5 pb-4 pt-4 sm:px-8">
        <UsLegalNotice slug={slug} />
      </section>

      <section className="mx-auto max-w-[1320px] px-5 pb-14 pt-4 sm:px-8 sm:pb-20">
        <div className="ink hard rounded-[20px] bg-[#fff6e6] p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="ink-1 grid size-11 shrink-0 place-items-center rounded-2xl bg-white"><CircleAlert className="size-4 text-[#b26a00]" /></span>
            <div>
              <h2 className="text-lg font-extrabold tracking-[-.025em]">Research notes aren&rsquo;t product proof</h2>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#111214]/70">{compound.researchNote}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="ink hard rounded-[18px] bg-white p-5">
      <Icon className="size-4 text-[#6d5dfc]" />
      <p className="mt-5 text-2xl font-extrabold tracking-[-.045em]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{label}</p>
    </div>
  );
}

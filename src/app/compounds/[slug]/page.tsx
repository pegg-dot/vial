import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, ChartNoAxesCombined, CircleAlert, FileSearch, Layers3 } from "lucide-react";
import { ArtMolecule, ArtDroplet } from "@/components/vial-art";
import { getCompoundBySlug, getProductsByCompoundSlug } from "@/server/catalog/repository";
import { formatCurrency } from "@/lib/format";
import { educationFor } from "@/lib/compound-education";
import { GoalTags } from "@/components/goal-tags";
import { CompoundKnowledge } from "@/components/compound-knowledge";
import { UsLegalNotice } from "@/components/us-legal-notice";
import { PriceSparkline } from "@/components/price-sparkline";
import { ProductCard } from "@/components/product-card";
import { FollowButton } from "@/components/follow-button";
import { DataOriginBadge } from "@/components/data-origin-badge";
import { LabTestsPanel } from "@/components/lab-tests-panel";
import { PriceLeaderboard } from "@/components/price-leaderboard";
import { getLabTestsForCompound } from "@/server/ingest/lab-tests";
import { getDatabase } from "@/server/db/client";
import { getCurrentPrincipal } from "@/server/auth/principal";
import { listFollows } from "@/server/consumer-intelligence/repository";
import { getCompoundResearch, getCompoundRegulatory } from "@/server/external/repository";
import { CompoundResearchPanel } from "@/components/compound-research-panel";
import { InnovatorNote } from "@/components/innovator-note";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const compound = await getCompoundBySlug(slug);
  if (!compound) return {};
  return {
    title: `${compound.name} market`,
    description: `Compare ${compound.name} research listings, price history, and documentation coverage.`,
  };
}

export default async function CompoundPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const compound = await getCompoundBySlug(slug);
  if (!compound) notFound();
  const [listings, principal, labTests, research, regulatory] = await Promise.all([getProductsByCompoundSlug(slug), getCurrentPrincipal(), getDatabase().then((db) => getLabTestsForCompound(db, slug)), getDatabase().then((db) => getCompoundResearch(slug, db)), getDatabase().then((db) => getCompoundRegulatory(slug, db))]);
  const edu = educationFor(slug);
  // "Commonly stacked with" = the bundles surface. Resolve each stacked slug to a real compound
  // (so we only ever link to compounds we actually track) and carry its cheapest listing price.
  const stacked = edu?.stackedWith?.length
    ? (await Promise.all(edu.stackedWith.map((s) => getCompoundBySlug(s)))).filter((c): c is NonNullable<typeof c> => Boolean(c))
    : [];
  const follows = principal ? await listFollows(principal.id) : [];
  const followed = follows.some((item) => item.entityType === "compound" && item.entitySlug === slug);
  const averageHistory = listings[0]?.priceHistory.map((_, index) => {
    const values = listings.map((item) => item.priceHistory[index]).filter((value): value is number => typeof value === "number");
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }) ?? [compound.medianPrice];

  return (
    <>
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
              <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-[#111214]/70">{compound.description}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {compound.aliases.map((alias) => <span key={alias} className="ink-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#111214]/70">{alias}</span>)}
              </div>
              <div className="mt-6"><FollowButton entityType="compound" entitySlug={slug} initialFollowed={followed} authenticated={Boolean(principal)} /></div>
            </div>
            <div className="ink hard-lg rounded-[22px] bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">Observed median price</p>
                  <p className="mt-1.5 text-5xl font-extrabold tracking-[-.055em]">{formatCurrency(compound.medianPrice)}</p>
                </div>
                <span className={`ink-1 rounded-full px-2.5 py-1 text-xs font-extrabold ${compound.priceChange < 0 ? "bg-[#e6fbf6] text-[#0e8f80]" : "bg-[#ffecea] text-[#d3372c]"}`}>{compound.priceChange > 0 ? "+" : ""}{compound.priceChange}%</span>
              </div>
              <div className="mt-5 h-28"><PriceSparkline values={averageHistory} accent={compound.accent[0]} height={94} /></div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-14 sm:px-8 sm:py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={Layers3} label="Active listings" value={String(compound.listings)} />
          <Stat icon={FileSearch} label="Independent lab tests" value={compound.medianPurity != null ? `${compound.coaCount} · ${compound.medianPurity.toFixed(1)}%` : String(compound.coaCount)} />
          <Stat icon={ChartNoAxesCombined} label="Observed price range" value={listings.length ? `${formatCurrency(Math.min(...listings.map((item) => item.price)))}–${formatCurrency(Math.max(...listings.map((item) => item.price)))}` : "No active listings"} />
          <Stat icon={BookOpen} label="Known aliases" value={String(compound.aliases.length + 1)} />
        </div>
      </section>

      {edu ? (
        <section className="mx-auto max-w-[1320px] px-5 pb-4 sm:px-8">
          <CompoundKnowledge name={compound.name} education={edu} showStacks={false} />
        </section>
      ) : null}

      <section className="mx-auto max-w-[1320px] px-5 pb-4 sm:px-8">
        <UsLegalNotice slug={slug} />
      </section>

      <section className="mx-auto max-w-[1320px] px-5 pb-4 sm:px-8">
        <InnovatorNote slug={slug} compoundName={compound.name} />
      </section>

      <CompoundResearchPanel findings={research} regulatoryStatus={regulatory?.regulatory_status ?? null} evidenceSummary={regulatory?.evidence_summary ?? null} compoundName={compound.name} />

      <PriceLeaderboard compoundName={compound.name} listings={listings} labTests={labTests} />

      <section className="mx-auto max-w-[1320px] px-5 pb-4 sm:px-8">
        <div className="mb-7">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#5a4be0]">Current market</p>
          <h2 className="mt-3 text-[clamp(1.8rem,3.6vw,2.6rem)] font-extrabold leading-[.98] tracking-[-.04em]">All {compound.name} listings</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{listings.map((product) => <ProductCard key={product.slug} product={product} />)}</div>
      </section>

      {stacked.length ? (
        <section className="mx-auto max-w-[1320px] px-5 pb-4 sm:px-8">
          <div className="mb-7">
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#5a4be0]">Commonly researched together</p>
            <h2 className="mt-3 text-[clamp(1.8rem,3.6vw,2.6rem)] font-extrabold leading-[.98] tracking-[-.04em]">Often stacked with {compound.name}</h2>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[var(--muted)]">Compounds the research community frequently discusses alongside {compound.name}. Not a protocol or a recommendation — a starting point for what to read about next.</p>
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

      <LabTestsPanel tests={labTests} heading={`${compound.name} — independent lab tests`} />

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

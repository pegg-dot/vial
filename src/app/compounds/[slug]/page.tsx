import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, ChartNoAxesCombined, CircleAlert, FileSearch, Layers3 } from "lucide-react";
import { getCompoundBySlug, getProductsByCompoundSlug } from "@/server/catalog/repository";
import { formatCurrency } from "@/lib/format";
import { PriceSparkline } from "@/components/price-sparkline";
import { ProductCard } from "@/components/product-card";
import { FollowButton } from "@/components/follow-button";
import { DataOriginBadge } from "@/components/data-origin-badge";
import { LabTestsPanel } from "@/components/lab-tests-panel";
import { getLabTestsForCompound } from "@/server/ingest/lab-tests";
import { getDatabase } from "@/server/db/client";
import { getCurrentPrincipal } from "@/server/auth/principal";
import { listFollows } from "@/server/consumer-intelligence/repository";

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
  const [listings, principal, labTests] = await Promise.all([getProductsByCompoundSlug(slug), getCurrentPrincipal(), getDatabase().then((db) => getLabTestsForCompound(db, slug))]);
  const follows = principal ? await listFollows(principal.id) : [];
  const followed = follows.some((item) => item.entityType === "compound" && item.entitySlug === slug);
  const averageHistory = listings[0]?.priceHistory.map((_, index) => {
    const values = listings.map((item) => item.priceHistory[index]).filter((value): value is number => typeof value === "number");
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }) ?? [compound.medianPrice];

  return (
    <>
      <section className="border-b border-black/[.06]">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8 sm:py-16">
          <Link href="/market" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-black"><ArrowLeft className="size-4" /> Back to market</Link>
          <div className="mt-10 grid gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-black/[.07] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-black/55">
                  <span className="size-2 rounded-full" style={{ background: compound.accent[0] }} /> {compound.category}
                </div>
                {compound.origin === "live" && <DataOriginBadge origin="live" />}
              </div>
              <h1 className="mt-5 text-6xl font-semibold leading-[.9] tracking-[-.075em] sm:text-8xl">{compound.name}</h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">{compound.description}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {compound.aliases.map((alias) => <span key={alias} className="rounded-full bg-black/[.045] px-3 py-1.5 text-xs text-black/55">{alias}</span>)}
              </div>
              <div className="mt-6"><FollowButton entityType="compound" entitySlug={slug} initialFollowed={followed} authenticated={Boolean(principal)} /></div>
            </div>
            <div className="rounded-[28px] border border-black/[.07] bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-[var(--muted)]">Observed median price</p>
                  <p className="mt-1 text-4xl font-semibold tracking-[-.055em]">{formatCurrency(compound.medianPrice)}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${compound.priceChange < 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{compound.priceChange > 0 ? "+" : ""}{compound.priceChange}%</span>
              </div>
              <div className="mt-5 h-28"><PriceSparkline values={averageHistory} accent={compound.accent[0]} height={94} /></div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-14 sm:px-8 sm:py-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={Layers3} label="Active listings" value={String(compound.listings)} />
          <Stat icon={FileSearch} label="Listings with current tests" value={`${compound.documentationCoverage}%`} />
          <Stat icon={ChartNoAxesCombined} label="Observed price range" value={listings.length ? `${formatCurrency(Math.min(...listings.map((item) => item.price)))}–${formatCurrency(Math.max(...listings.map((item) => item.price)))}` : "No active listings"} />
          <Stat icon={BookOpen} label="Known aliases" value={String(compound.aliases.length + 1)} />
        </div>

        <div className="mt-14 mb-7">
          <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Current market</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-.045em]">All {compound.name} listings</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{listings.map((product) => <ProductCard key={product.slug} product={product} />)}</div>
      </section>

      <LabTestsPanel tests={labTests} heading={`${compound.name} — independent lab tests`} />

      <section className="mx-auto max-w-[1320px] px-5 pb-14 sm:px-8 sm:pb-20">
        <div className="mt-4 rounded-[28px] border border-amber-200 bg-amber-50 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-100"><CircleAlert className="size-4 text-amber-800" /></span>
            <div>
              <h2 className="text-lg font-semibold tracking-[-.025em]">Research notes aren&rsquo;t product proof</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-950/70">{compound.researchNote}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-black/[.07] bg-white p-5">
      <Icon className="size-4 text-black/35" />
      <p className="mt-6 text-2xl font-semibold tracking-[-.045em]">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{label}</p>
    </div>
  );
}

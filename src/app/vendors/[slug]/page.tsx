import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, BadgeCheck, Building2, CheckCircle2, CircleDashed, Clock3, Layers, MapPin, PackageSearch, ShieldCheck } from "lucide-react";
import { getProductsByVendorSlug, getVendorBySlug } from "@/server/catalog/repository";
import { getVendorReputationBySlug, type ReputationDimension } from "@/server/reputation/repository";
import { vendorStatusLabel } from "@/lib/format";
import { ProductCard } from "@/components/product-card";
import { VendorMark } from "@/components/vendor-mark";
import { DataOriginBadge } from "@/components/data-origin-badge";
import { VendorVerdictBanner } from "@/components/vendor-verdict-banner";
import { verdictForVendorSlug } from "@/server/verify";
import { FollowButton } from "@/components/follow-button";
import { getCurrentPrincipal } from "@/server/auth/principal";
import { listFollows } from "@/server/consumer-intelligence/repository";
import { CommunitySignalCard } from "@/components/community-signal-card";
import { getStoredCommunitySignal } from "@/server/ingest/reddit";
import { getDatabase } from "@/server/db/client";
import { LabTestsPanel } from "@/components/lab-tests-panel";
import { getLabTestsForVendor } from "@/server/ingest/lab-tests";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const vendor = await getVendorBySlug(slug);
  if (!vendor) return {};
  return {
    title: vendor.name,
    description: `View the ${vendor.origin === "live" ? "real" : "demo"} ${vendor.name} catalog, documentation freshness, profile status, and market history.`,
  };
}

export default async function VendorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vendor = await getVendorBySlug(slug);
  if (!vendor) notFound();
  const [listings, principal, reputation, communitySignal, vendorLabTests] = await Promise.all([getProductsByVendorSlug(slug), getCurrentPrincipal(), getVendorReputationBySlug(slug), getDatabase().then((db) => getStoredCommunitySignal(db, slug)), getDatabase().then((db) => getLabTestsForVendor(db, slug, 24))]);
  const follows = principal ? await listFollows(principal.id) : [];
  const followed = follows.some((item) => item.entityType === "vendor" && item.entitySlug === slug);
  const verdict = verdictForVendorSlug(slug);

  return (
    <>
      <section className="border-b border-black/[.06]">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8 sm:py-16">
          <Link href="/market" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-black"><ArrowLeft className="size-4" /> Back to market</Link>
          {verdict && <div className="mt-6"><VendorVerdictBanner verdict={verdict.verdict} summary={verdict.summary} /></div>}
          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_.72fr] lg:items-end">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <VendorMark initials={vendor.initials} accent={vendor.accent} size="lg" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700"><BadgeCheck className="size-3" /> {vendorStatusLabel(vendor.profileStatus)}</span>
                  <DataOriginBadge origin={vendor.origin} />
                </div>
                <h1 className="mt-4 text-5xl font-semibold leading-[.94] tracking-[-.065em] sm:text-6xl">{vendor.name}</h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)]">{vendor.description}</p>
                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--muted)]">
                  {vendor.location && <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" /> {vendor.location}</span>}
                  {vendor.founded && <span className="inline-flex items-center gap-1.5"><Building2 className="size-4" /> First observed {vendor.founded}</span>}
                  {vendor.lastObserved && <span className="inline-flex items-center gap-1.5"><Clock3 className="size-4" /> Updated {vendor.lastObserved}</span>}
                </div>
                <div className="mt-6"><FollowButton entityType="vendor" entitySlug={slug} initialFollowed={followed} authenticated={Boolean(principal)} /></div>
              </div>
            </div>
            <div className="rounded-[28px] border border-black/[.07] bg-white p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[var(--muted)]">Profile signal</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {vendor.documentationCurrent > 0
                  ? <VendorStat icon={ShieldCheck} value={`${vendor.documentationCurrent}%`} label="Tests current" />
                  : <VendorStat icon={ShieldCheck} value={vendorLabTests.length > 0 ? String(vendorLabTests.length) : "—"} label={vendorLabTests.length > 0 ? "Independent COAs" : "Tests current"} />}
                <VendorStat icon={PackageSearch} value={String(vendor.productCount)} label={vendor.productCount === 1 ? "Product tracked" : "Products tracked"} />
              </div>
              <p className="mt-4 text-[11px] leading-4 text-[var(--muted)]">No single star rating here — just what we actually know about this vendor, piece by piece, below.</p>
            </div>
          </div>
        </div>
      </section>

      {reputation && (
        <section className="mx-auto max-w-[1320px] px-5 pt-14 sm:px-8 sm:pt-20">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Reputation</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-.045em]">We don&rsquo;t boil it down to one rating</h2>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[.045] px-3 py-1 text-[11px] font-semibold text-black/55"><Layers className="size-3" /> methodology {reputation.methodologyVersion}</span>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {reputation.dimensions.map((d) => <ReputationTile key={d.key} dimension={d} />)}
          </div>
          <p className="mt-5 max-w-3xl text-xs leading-5 text-[var(--muted)]">Each answer stands on its own and cites its source. Where we don&rsquo;t have the evidence, it says unknown — we never invent a number or blend everything into one score.</p>
        </section>
      )}

      {vendorLabTests.length > 0 && <LabTestsPanel tests={vendorLabTests} heading={`${vendor.name} — independent lab tests on record`} />}

      {communitySignal && <CommunitySignalCard signal={communitySignal} />}

      <section className="mx-auto max-w-[1320px] px-5 py-14 sm:px-8 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
          <div>
            <div className="mb-7">
              <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Catalog</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-.045em]">What they sell</h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">{listings.map((product) => <ProductCard key={product.slug} product={product} />)}</div>
          </div>

          <aside>
            <div className="sticky top-28 rounded-[26px] border border-black/[.07] bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[var(--muted)]">History</p>
              <div className="mt-5 space-y-0">
                {vendor.history.map((item, index) => (
                  <div key={`${item.date}-${item.event}`} className="relative flex gap-3 pb-6 last:pb-0">
                    {index < vendor.history.length - 1 && <span className="absolute left-[6px] top-4 h-full w-px bg-black/[.08]" />}
                    <span className="relative mt-1 size-3 shrink-0 rounded-full border-[3px] border-white bg-[var(--accent)] shadow-[0_0_0_1px_rgba(17,18,20,.12)]" />
                    <div>
                      <p className="text-xs font-semibold text-black/50">{item.date}</p>
                      <p className="mt-1 text-sm leading-5">{item.event}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[.12em] text-[var(--muted)]">{item.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}

const PLAIN_DIMENSION_LABELS: Record<string, string> = {
  identity_claim: "Who they are",
  documentation_currency: "Lab tests current?",
  evidence_corroboration: "Independently tested?",
  operational_reliability: "Track record shipping",
  community_signal: "What buyers say",
  open_risk_flags: "Scam & red flags",
};

function ReputationTile({ dimension }: { dimension: ReputationDimension }) {
  const tone = dimension.status === "established"
    ? { chip: "bg-emerald-50 text-emerald-800", Icon: CheckCircle2, iconClass: "text-emerald-700", card: "border-black/[.07] bg-white" }
    : dimension.status === "disputed"
    ? { chip: "bg-amber-50 text-amber-800", Icon: AlertTriangle, iconClass: "text-amber-700", card: "border-amber-200 bg-amber-50" }
    : { chip: "bg-black/[.05] text-black/55", Icon: CircleDashed, iconClass: "text-black/35", card: "border-dashed border-black/15 bg-black/[.015]" };
  return (
    <div className={`rounded-[26px] border p-5 ${tone.card}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{PLAIN_DIMENSION_LABELS[dimension.key] ?? dimension.label}</h3>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${tone.chip}`}><tone.Icon className={`size-3 ${tone.iconClass}`} />{dimension.status}</span>
      </div>
      <p className="mt-3 text-lg font-semibold tracking-[-.02em]">{dimension.value}</p>
      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{dimension.basis}</p>
    </div>
  );
}

function VendorStat({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-black/[.035] p-4">
      <Icon className="size-4 text-black/35" />
      <p className="mt-4 text-lg font-semibold tracking-[-.03em]">{value}</p>
      <p className="mt-1 text-[10px] text-[var(--muted)]">{label}</p>
    </div>
  );
}

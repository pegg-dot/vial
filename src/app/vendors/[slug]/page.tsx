import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, CircleAlert, CircleDashed, Clock3, FlaskConical, MapPin, PackageSearch, ShieldCheck, Star, X } from "lucide-react";
import { getProductsByVendorSlug, getVendorBySlug } from "@/server/catalog/repository";
import { getVendorReputationBySlug } from "@/server/reputation/repository";
import { vendorStatusLabel } from "@/lib/format";
import { ProductCard } from "@/components/product-card";
import { VendorMark } from "@/components/vendor-mark";
import { DataOriginBadge } from "@/components/data-origin-badge";
import { verdictForVendorSlug } from "@/server/verify";
import type { Verdict } from "@/server/verify";
import { getVendorRegulatoryActions } from "@/server/regulatory/repository";
import { verdictFromSeverities } from "@/server/regulatory/actions";
import { EnforcementBanner } from "@/components/enforcement-banner";
import { FollowButton } from "@/components/follow-button";
import { getCurrentPrincipal } from "@/server/auth/principal";
import { listFollows } from "@/server/consumer-intelligence/repository";
import { CommunitySignalCard } from "@/components/community-signal-card";
import { getStoredCommunitySignal } from "@/server/ingest/reddit";
import { getDatabase } from "@/server/db/client";
import { LabTestsPanel } from "@/components/lab-tests-panel";
import { getLabTestsForVendor } from "@/server/ingest/lab-tests";
import { VendorFlagsBanner } from "@/components/vendor-flags-banner";
import { getVendorFlags } from "@/server/verify/coa-integrity";
import { VendorLinksPanel } from "@/components/vendor-links-panel";
import { getVendorLinks } from "@/server/verify/vendor-linkage";
import { VendorReputationTiles } from "@/components/vendor-reputation-tiles";
import { VendorReviewsPanel } from "@/components/vendor-reviews-panel";
import { getVendorReview } from "@/server/verify/vendor-reviews";
import { VendorStatusBanner } from "@/components/vendor-status-banner";
import { getVendorStatus } from "@/server/verify/vendor-status";
import { getVendorAggregatorRatings, getVendorSignals, getVendorOffers } from "@/server/external/repository";
import { AggregatorRatingsPanel } from "@/components/aggregator-ratings-panel";
import { VendorSignalsPanel } from "@/components/vendor-signals-panel";
import { VendorOffersPanel } from "@/components/vendor-offers-panel";
import { SectionHead, JumpNav } from "@/components/vendor-report-chrome";

export const dynamic = "force-dynamic";

const STEEL = "#39414e";
const VERDICT_UI: Record<Verdict, { label: string; bg: string; accent: string; icon: typeof ShieldCheck }> = {
  trusted: { label: "Generally trusted", bg: "bg-[#e6fbf6]", accent: "#0e8f80", icon: ShieldCheck },
  caution: { label: "Proceed with caution", bg: "bg-[#fff6e6]", accent: "#b26a00", icon: CircleAlert },
  unproven: { label: "Unproven", bg: "bg-[#fff6e6]", accent: "#b26a00", icon: CircleDashed },
  info: { label: "For your information", bg: "bg-[#eef0ff]", accent: "#2b31d8", icon: CircleDashed },
  "high-risk": { label: "High risk", bg: "bg-[#ffecea]", accent: "#d3372c", icon: CircleAlert },
  avoid: { label: "Avoid — do not buy", bg: "bg-[#ffecea]", accent: "#d3372c", icon: X },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const vendor = await getVendorBySlug(slug);
  if (!vendor) return {};
  return { title: vendor.name, description: `What VIAL knows about ${vendor.name}: verdict, independent lab tests, reputation, and market history.` };
}

export default async function VendorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vendor = await getVendorBySlug(slug);
  if (!vendor) notFound();
  const [listings, principal, reputation, communitySignal, vendorLabTests, vendorFlags, vendorLinks, vendorReview, vendorStatus, enforcement, aggregatorRatings, vendorSignals, vendorOffers] = await Promise.all([getProductsByVendorSlug(slug), getCurrentPrincipal(), getVendorReputationBySlug(slug), getDatabase().then((db) => getStoredCommunitySignal(db, slug)), getDatabase().then((db) => getLabTestsForVendor(db, slug, 24)), getDatabase().then((db) => getVendorFlags(db, slug)), getDatabase().then((db) => getVendorLinks(db, slug)), getDatabase().then((db) => getVendorReview(db, slug)), getDatabase().then((db) => getVendorStatus(db, slug)), getDatabase().then((db) => getVendorRegulatoryActions(slug, db)), getDatabase().then((db) => getVendorAggregatorRatings(slug, db)), getDatabase().then((db) => getVendorSignals(slug, db)), getDatabase().then((db) => getVendorOffers(slug, db))]);
  const follows = principal ? await listFollows(principal.id) : [];
  const followed = follows.some((item) => item.entityType === "vendor" && item.entitySlug === slug);

  // A public enforcement record outranks the static verdict: a severe action forces "avoid".
  const regVerdict = verdictFromSeverities(enforcement.map((a) => a.severity as "severe" | "caution" | "informational"));
  const staticVerdict = verdictForVendorSlug(slug);
  const verdict = regVerdict === "avoid"
    ? { verdict: "avoid" as const, summary: staticVerdict?.summary ?? `On a public regulatory/enforcement record (${enforcement.filter((a) => a.severity === "severe").length} severe). See the sourced records below.` }
    : staticVerdict;
  const v = verdict ? VERDICT_UI[verdict.verdict] : null;

  const hasAlerts = (vendorStatus && vendorStatus.status !== "operating") || vendorFlags.length > 0 || enforcement.length > 0;
  const secondaryLabel = vendor.kind === "storefront" ? "Listings" : "Batch passports";
  const secondaryValue = vendor.kind === "storefront" ? vendor.productCount : vendor.passportCount;

  // Jump-nav: only sections that actually have content.
  const nav = [
    reputation ? { id: "reputation", label: "Reputation" } : null,
    vendorLabTests.length > 0 ? { id: "lab-tests", label: "Lab tests" } : null,
    aggregatorRatings.length > 0 ? { id: "trackers", label: "Trackers" } : null,
    vendorSignals ? { id: "signals", label: "Signals" } : null,
    (vendorReview || communitySignal) ? { id: "reviews", label: "Buyers" } : null,
    enforcement.length > 0 ? { id: "enforcement", label: "Enforcement" } : null,
    listings.length > 0 ? { id: "catalog", label: "Catalog" } : null,
    { id: "history", label: "History" },
  ].filter((x): x is { id: string; label: string } => Boolean(x));

  return (
    <>
      {/* ── Report header: steel signature, verdict-forward ─────────────────────────── */}
      <section className="relative isolate overflow-hidden border-b-2 border-[#111214] text-white" style={{ background: STEEL }}>
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8 sm:py-14">
          <Link href="/vendors" className="inline-flex items-center gap-2 text-sm font-bold text-white/70 transition hover:text-white"><ArrowLeft className="size-4" /> All vendors</Link>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-stretch">
            {/* identity */}
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="shrink-0"><VendorMark initials={vendor.initials} accent={vendor.accent} size="lg" /></div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[.08em] text-white">{vendor.kind === "manufacturer" ? "Manufacturer" : "Storefront"}</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-bold text-white">{vendorStatusLabel(vendor.profileStatus)}</span>
                  <DataOriginBadge origin={vendor.origin} />
                </div>
                <h1 className="mt-4 text-balance text-[clamp(2.6rem,6vw,4.5rem)] font-extrabold leading-[.9] tracking-[-.045em]">{vendor.name}</h1>
                <p className="mt-4 max-w-xl text-[15px] font-medium leading-7 text-white/75">{vendor.description}</p>
                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-semibold text-white/65">
                  {vendor.location && <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" /> {vendor.location}</span>}
                  {vendor.founded && <span className="inline-flex items-center gap-1.5"><Building2 className="size-4" /> First seen {vendor.founded}</span>}
                  {vendor.lastObserved && <span className="inline-flex items-center gap-1.5"><Clock3 className="size-4" /> Updated {vendor.lastObserved}</span>}
                </div>
                <div className="mt-6"><FollowButton entityType="vendor" entitySlug={slug} initialFollowed={followed} authenticated={Boolean(principal)} /></div>
              </div>
            </div>

            {/* the bottom line — the verdict */}
            {v && verdict ? (
              <div className={`ink hard-lg flex flex-col rounded-[22px] p-6 text-[#111214] ${v.bg}`}>
                <div className="ink inline-flex w-fit items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[.12em]" style={{ color: v.accent }}><v.icon className="size-4" /> VIAL verdict</div>
                <h2 className="mt-4 text-3xl font-extrabold tracking-[-.03em]">{v.label}</h2>
                <p className="mt-2 text-[15px] font-medium leading-7 text-[#111214]/75">{verdict.summary}</p>
              </div>
            ) : (
              <div className="ink hard-lg flex flex-col justify-center rounded-[22px] bg-white p-6 text-[#111214]">
                <div className="ink inline-flex w-fit items-center gap-2 rounded-full bg-[#e6fbf6] px-3 py-1 text-[11px] font-bold uppercase tracking-[.12em] text-[#0e8f80]"><ShieldCheck className="size-4" /> No red flags on record</div>
                <p className="mt-4 text-[15px] font-medium leading-7 text-[#111214]/75">We don&rsquo;t hold any scam reports, enforcement actions, or integrity flags for {vendor.name}. That isn&rsquo;t an endorsement &mdash; below is exactly what we do and don&rsquo;t know, piece by piece.</p>
              </div>
            )}
          </div>

          {/* at-a-glance stats */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeroStat icon={FlaskConical} value={String(vendor.coaCount)} label="Independent lab tests" />
            <HeroStat icon={ShieldCheck} value={vendor.medianPurity != null ? `${vendor.medianPurity.toFixed(1)}%` : "—"} label="Median tested purity" />
            <HeroStat icon={PackageSearch} value={String(secondaryValue)} label={secondaryLabel} />
            <HeroStat icon={Star} value={vendor.reviewCount > 0 ? String(vendor.reviewCount) : "—"} label="Buyer reviews on file" />
          </div>
        </div>
      </section>

      {/* ── Alerts: grouped, only when present ──────────────────────────────────────── */}
      {hasAlerts && (
        <section className="mx-auto max-w-[1320px] space-y-4 px-5 pt-10 sm:px-8">
          {vendor.kind === "manufacturer" && <div className="ink hard-sm rounded-[18px] bg-[#fff6e6] p-5 text-sm font-medium leading-6 text-[#111214]"><span className="font-extrabold">Upstream manufacturer, not a storefront.</span> We surfaced {vendor.name} from third-party lab records &mdash; the party a certificate names as having made or ordered the tested material, not a shop you buy from directly. Treat its test history as upstream intelligence.</div>}
          {vendorStatus && vendorStatus.status !== "operating" && <VendorStatusBanner status={vendorStatus} vendorName={vendor.name} />}
          {vendorFlags.length > 0 && <VendorFlagsBanner flags={vendorFlags} vendorName={vendor.name} />}
          {enforcement.length > 0 && <EnforcementBanner actions={enforcement} vendorName={vendor.name} />}
        </section>
      )}

      {/* ── Sticky jump-nav ─────────────────────────────────────────────────────────── */}
      <JumpNav items={nav} />

      {/* ── Evidence ────────────────────────────────────────────────────────────────── */}
      {reputation && (
        <section id="reputation" className="mx-auto max-w-[1320px] scroll-mt-24 px-5 pt-14 sm:px-8">
          <SectionHead eyebrow="Reputation" title="We don't boil it down to one rating" note={`methodology ${reputation.methodologyVersion}`} />
          <div className="mt-7"><VendorReputationTiles dimensions={reputation.dimensions} /></div>
          <p className="mt-5 max-w-3xl text-xs font-medium leading-5 text-[var(--muted)]">Each answer stands on its own and cites its source. Where we don&rsquo;t have the evidence, it says unknown &mdash; we never invent a number or blend everything into one score.</p>
        </section>
      )}

      {vendorLabTests.length > 0 && <div id="lab-tests" className="scroll-mt-24"><LabTestsPanel tests={vendorLabTests} heading={`${vendor.name} — independent lab tests on record`} /></div>}
      {aggregatorRatings.length > 0 && <div id="trackers" className="scroll-mt-24"><AggregatorRatingsPanel ratings={aggregatorRatings} vendorName={vendor.name} /></div>}
      {vendorSignals && <div id="signals" className="scroll-mt-24"><VendorSignalsPanel signals={vendorSignals} vendorName={vendor.name} /></div>}
      {vendorReview && <div id="reviews" className="scroll-mt-24"><VendorReviewsPanel review={vendorReview} /></div>}
      {communitySignal && <CommunitySignalCard signal={communitySignal} />}
      {enforcement.length > 0 && <div id="enforcement" className="scroll-mt-24" />}
      {vendorOffers.length > 0 && <VendorOffersPanel offers={vendorOffers} vendorName={vendor.name} />}
      <VendorLinksPanel links={vendorLinks} vendorName={vendor.name} />

      {/* ── Catalog + history ───────────────────────────────────────────────────────── */}
      <section id="catalog" className="mx-auto max-w-[1320px] scroll-mt-24 px-5 py-16 sm:px-8 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
          <div>
            {listings.length > 0 ? (
              <>
                <SectionHead eyebrow="Catalog" title="What they sell" />
                <div className="mt-7 grid gap-5 sm:grid-cols-2">{listings.map((product) => <ProductCard key={product.slug} product={product} />)}</div>
              </>
            ) : (
              <div className="ink rounded-[22px] bg-white p-8">
                <SectionHead eyebrow="Catalog" title="No shoppable listings" />
                <p className="mt-4 max-w-md text-sm font-medium leading-6 text-[var(--muted)]">We track {vendor.name} from lab records and public sources, but haven&rsquo;t captured a live storefront catalog{vendor.kind === "manufacturer" ? " — it&rsquo;s an upstream manufacturer, not a shop" : ""}.</p>
              </div>
            )}
          </div>

          <aside id="history" className="scroll-mt-24">
            <div className="ink-1 hard sticky top-28 rounded-[20px] bg-white p-5">
              <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#2b31d8]">History</p>
              <div className="mt-5 space-y-0">
                {vendor.history.map((item, index) => (
                  <div key={`${item.date}-${item.event}`} className="relative flex gap-3 pb-6 last:pb-0">
                    {index < vendor.history.length - 1 && <span className="absolute left-[6px] top-4 h-full w-0.5 bg-[#111214]/12" />}
                    <span className="relative mt-1 size-3.5 shrink-0 rounded-full border-2 border-[#111214] bg-[#2b31d8]" />
                    <div>
                      <p className="text-xs font-bold text-black/45">{item.date}</p>
                      <p className="mt-1 text-sm font-semibold leading-5">{item.event}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">{item.type}</p>
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

function HeroStat({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: string; label: string }) {
  return <div className="ink hard rounded-[16px] bg-white p-4 text-[#111214]"><Icon className="size-4 text-[#39414e]" /><p className="mt-3 text-2xl font-extrabold tracking-[-.04em]">{value}</p><p className="mt-0.5 text-[11px] font-semibold leading-4 text-[var(--muted)]">{label}</p></div>;
}

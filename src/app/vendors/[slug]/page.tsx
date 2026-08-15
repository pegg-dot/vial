import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { CATALOG_CACHE_TAG } from "@/server/catalog/repository";
import Link from "next/link";
import { ArrowLeft, Building2, Check, CircleDashed, Clock3, FlaskConical, MapPin, PackageSearch, ShieldCheck, Star, Tag, TrendingDown, TrendingUp, X } from "lucide-react";
import { getCatalogSnapshot, getProductsByVendorSlug, getVendorBySlug } from "@/server/catalog/repository";
import { vendorPriceIndex } from "@/lib/curation";
import { daysSince } from "@/lib/format";
import { getVendorReputationBySlug } from "@/server/reputation/repository";
import { vendorClaimLabel } from "@/lib/vendor-copy";
import { PURITY_PROVENANCE_SHORT } from "@/lib/provenance-copy";
import { TierChip } from "@/components/signal-tier-chip";
import { signalLabel } from "@/lib/signal-copy";
import { ProductCard } from "@/components/product-card";
import { VendorMark } from "@/components/vendor-mark";
import { DataOriginBadge } from "@/components/data-origin-badge";
import { composeVerdict } from "@/server/verify/trust-graph";
import { gradeFromVerdict } from "@/server/verify/grade";
import { persistVendorGrade } from "@/server/verify/grade-store";
import { VialGradeCard } from "@/components/vial-grade-card";
import { getVendorRegulatoryActions } from "@/server/regulatory/repository";
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
import { JsonLd } from "@/components/json-ld";
import { vendorSchema } from "@/lib/structured-data";

export const dynamic = "force-dynamic";

const STEEL = "#39414e";

// The plain words for a gathered-review verdict, matching the labels the reviews panel prints, so
// the summary at the top and the section further down can never say two different things.
const REVIEW_PLAIN: Record<string, string> = {
  positive: "mostly positive", mixed: "mixed", negative: "mostly negative",
  scam: "scam or fraud reports", unknown: "no clear signal",
};

/** "a", "a and b", "a, b and c" — for reading a list of findings out loud in a sentence. */
function joinList(parts: Array<string | null | false>): string {
  const list = parts.filter((p): p is string => Boolean(p));
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

// The share image is inherited from the root layout by hand: page-level `openGraph` REPLACES the
// parent object wholesale (it is a shallow merge), so omitting these would have shipped every
// vendor page with no preview image at all.
const OG_IMAGE = [{ url: "/og-image.png", width: 1200, height: 630, alt: "VialGrade" }];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const vendor = await getVendorBySlug(slug);
  if (!vendor) return {};
  // The title is the question a reader actually types. A question asserts nothing — which is the
  // only honest way to head a page about whether a seller can be trusted. The root layout appends
  // " · VialGrade", so this half stays short.
  // "Is X legit?" is only an honest title where the page can answer it. A vendor with nothing
  // listed is graded as a maker, not a shop (see `gradeFromVerdict`) — the same predicate is used
  // for the page's own headline, so the tab title and the h2 can never ask different questions.
  const title = vendor.kind === "manufacturer" || vendor.productCount === 0
    ? `${vendor.name}: what the lab record shows`
    : `Is ${vendor.name} legit? Lab tests & grade`;
  // The description states the evidence position we actually hold — read off the materialized
  // grade and the real counts on the vendor row, so anything quoting it quotes the real thing.
  // `vendor` comes from the cached catalog snapshot, so none of this costs an extra query.
  const grade = vendor.grade;
  const evidence = [
    vendor.coaCount > 0 ? `${vendor.coaCount} independent lab test${vendor.coaCount === 1 ? "" : "s"} on record` : "no independent lab test on record",
    vendor.medianPurity != null ? `${vendor.medianPurity.toFixed(1)}% median tested purity` : null,
    vendor.reviewCount > 0 ? `${vendor.reviewCount} buyer-reputation record${vendor.reviewCount === 1 ? "" : "s"}` : "no buyer-reputation record on file",
  ].filter(Boolean).join(", ");
  const description = `${grade?.headline ? `${grade.headline}. ` : ""}Evidence on file: ${evidence}. Independent lab tests, prices, regulatory records and buyer reports for ${vendor.name} — evidence, never an endorsement.`;
  return {
    title,
    description,
    alternates: { canonical: `/vendors/${slug}` },
    openGraph: { type: "website", url: `/vendors/${slug}`, siteName: "VialGrade", title: `${title} · VialGrade`, description, images: OG_IMAGE },
    twitter: { card: "summary_large_image", title: `${title} · VialGrade`, description, images: ["/og-image.png"] },
  };
}


// Everything on this page that is the SAME for every visitor, loaded once and cached.
//
// This page fired FOURTEEN database queries per request and was force-dynamic, so a crawler hit on
// each of ~83 vendor pages ran all of them again. None of this data is per-user: it is the vendor's
// listings, lab tests, reputation and flags. It is cached under the shared "catalog" tag, which the
// collect cron invalidates the moment it writes new data, so freshness is unchanged.
//
// getCurrentPrincipal() is deliberately NOT in here — it reads a cookie, and caching anything
// derived from a cookie would serve one visitor's session state to another.
const loadVendorPublicData = unstable_cache(
  async (slug: string) => {
    const [listings, catalog, reputation, communitySignal, vendorLabTests, vendorFlags, vendorLinks, vendorReview, vendorStatus, enforcement, aggregatorRatings, vendorSignals, vendorOffers] = await Promise.all([getProductsByVendorSlug(slug), getCatalogSnapshot(), getVendorReputationBySlug(slug), getDatabase().then((db) => getStoredCommunitySignal(db, slug)), getDatabase().then((db) => getLabTestsForVendor(db, slug, 24)), getDatabase().then((db) => getVendorFlags(db, slug)), getDatabase().then((db) => getVendorLinks(db, slug)), getDatabase().then((db) => getVendorReview(db, slug)), getDatabase().then((db) => getVendorStatus(db, slug)), getDatabase().then((db) => getVendorRegulatoryActions(slug, db)), getDatabase().then((db) => getVendorAggregatorRatings(slug, db)), getDatabase().then((db) => getVendorSignals(slug, db)), getDatabase().then((db) => getVendorOffers(slug, db))]);
    return { listings, catalog, reputation, communitySignal, vendorLabTests, vendorFlags, vendorLinks, vendorReview, vendorStatus, enforcement, aggregatorRatings, vendorSignals, vendorOffers };
  },
  ["vendor-page"],
  { tags: [CATALOG_CACHE_TAG], revalidate: 21600 },
);

export default async function VendorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vendor = await getVendorBySlug(slug);
  if (!vendor) notFound();
  const [publicData, principal] = await Promise.all([loadVendorPublicData(slug), getCurrentPrincipal()]);
  const { listings, catalog, reputation, communitySignal, vendorLabTests, vendorFlags, vendorLinks, vendorReview, vendorStatus, enforcement, aggregatorRatings, vendorSignals, vendorOffers } = publicData;
  // How this vendor's per-mg pricing sits against the market (the "are they a good deal?" stat).
  const priceIndex = vendorPriceIndex(listings, catalog.products);
  // Best value first — same market-consistent ordering as the rest of the app.
  const catalogSorted = [...listings].sort((a, b) => (a.pricePerMg ?? Infinity) - (b.pricePerMg ?? Infinity) || a.price - b.price);
  const follows = principal ? await listFollows(principal.id) : [];
  const followed = follows.some((item) => item.entityType === "vendor" && item.entitySlug === slug);

  // The trust graph: every seam we hold folds into one composed verdict (transparent rules, never a
  // black-box score). The factors below show exactly which seams it rests on.
  const composed = composeVerdict({
    vendorName: vendor.name,
    coaCount: vendor.coaCount,
    medianPurity: vendor.medianPurity,
    blindCount: vendorLabTests.filter((t) => t.is_blind).length,
    enforcement: enforcement.map((a) => ({ severity: a.severity })),
    reputationDimensions: reputation?.dimensions ?? [],
    aggregators: aggregatorRatings.map((a) => ({ source: a.source, score: a.score, max_score: a.max_score })),
    signals: vendorSignals,
    review: vendorReview ? { sentiment: vendorReview.sentiment, reviewVolume: vendorReview.reviewVolume, confidence: vendorReview.confidence } : null,
    community: communitySignal ? { sentiment: communitySignal.sentiment, mentionCount: communitySignal.mention_count, negativeCount: communitySignal.negative_count, positiveCount: communitySignal.positive_count } : null,
    links: vendorLinks.map((l) => ({ strength: l.strength, linkedSlug: l.linkedSlug })),
    status: vendorStatus ? { status: vendorStatus.status } : null,
    flagCount: vendorFlags.length,
  });
  // The headline letter is a projection of the verdict above — same seams, no second opinion.
  //
  // Computed live HERE, because this page has already loaded every seam. Market cards and product
  // pages read the MATERIALIZED copy on the vendor row instead (deriving it there would cost ~10
  // queries per card). They must never disagree, so this page writes its result back: this is the
  // definition of the grade, and everywhere else is a cache of it.
  const grade = gradeFromVerdict(composed, { coaCount: vendor.coaCount, listingCount: vendor.productCount });
  await persistVendorGrade(slug, grade, composed.summary).catch(() => {});

  // Only the going-dark states produce a banner (`VendorStatusBanner` renders nothing for "blocked"
  // or "unknown"). Keying the alert group off `status !== "operating"` instead used to open an empty
  // section — harmless while it was invisible, but the group now carries a heading that states what
  // is wrong, and a heading must never claim something the page then fails to show.
  const statusAlert = vendorStatus && ["offline", "parked", "redirected"].includes(vendorStatus.status) ? vendorStatus : null;
  const hasAlerts = Boolean(statusAlert) || vendorFlags.length > 0 || enforcement.length > 0;

  // If we can no longer read a storefront (a bot wall, a dead host), its prices freeze while still
  // rendering as if current. Showing a stale price as live is the same dishonesty this product
  // exists to catch, so say it plainly. Derived from the newest observation we actually hold.
  const newestObservation = listings.reduce<string | null>((newest, l) => {
    if (!l.observedAt) return newest;
    return !newest || l.observedAt > newest ? l.observedAt : newest;
  }, null);
  const staleDays = daysSince(newestObservation);
  const catalogStale = listings.length > 0 && staleDays != null && staleDays >= 3;
  const secondaryLabel = vendor.kind === "storefront" ? "Listings" : "Batch test records";
  const secondaryValue = vendor.kind === "storefront" ? vendor.productCount : vendor.passportCount;

  const maker = vendor.kind === "manufacturer";
  const strongLinks = vendorLinks.filter((l) => l.strength === "strong");
  const blindTests = vendorLabTests.filter((t) => t.is_blind).length;

  // The heading this whole page exists to answer, in the words the reader used. It is a question on
  // purpose: a question matches what was asked without asserting that the answer is "yes".
  //
  // "Is X legit?" is only asked where the page can answer it. A vendor with nothing listed is graded
  // as a maker rather than a shop (`gradeFromVerdict` keys off exactly this), so asking whether to
  // buy from them would head the page with a question its own verdict then refuses.
  const referenceOnly = maker || vendor.productCount === 0;
  const headlineQuestion = referenceOnly ? `What is on record for ${vendor.name}?` : `Is ${vendor.name} legit?`;

  // One sentence naming every seam the verdict rests on. Each clause is a count this page renders
  // further down — nothing new is derived here, so the summary can never drift from the sections.
  const restsOn = joinList([
    vendor.coaCount > 0
      ? `${vendor.coaCount} independent lab test${vendor.coaCount === 1 ? "" : "s"} on record${blindTests > 0 ? ` (${blindTests} of them blind)` : ""}`
      : "no independent lab test on record",
    enforcement.length > 0
      ? `${enforcement.length} public regulatory record${enforcement.length === 1 ? "" : "s"}`
      : "no FDA, DOJ or FTC enforcement record on file",
    vendorFlags.length > 0 ? `${vendorFlags.length} certificate-integrity flag${vendorFlags.length === 1 ? "" : "s"}` : null,
    strongLinks.length > 0 ? `shared identifiers with ${strongLinks.length} other storefront${strongLinks.length === 1 ? "" : "s"}` : null,
    vendorReview ? `buyer reports that read ${REVIEW_PLAIN[vendorReview.sentiment] ?? "unclear"}` : "no buyer-review record gathered yet",
    communitySignal ? `${communitySignal.mention_count} r/Peptides mention${communitySignal.mention_count === 1 ? "" : "s"}` : null,
  ]);

  // What the alert banners at the top are actually saying, stated once in plain words next to the
  // heading, so the section answers its own question without the reader parsing three banners.
  const alertReasons = joinList([
    statusAlert ? "its storefront is not responding normally" : null,
    vendorFlags.length > 0 ? `${vendorFlags.length} integrity flag${vendorFlags.length === 1 ? "" : "s"} on the lab certificates it publishes` : null,
    enforcement.length > 0 ? `${enforcement.length} public government record${enforcement.length === 1 ? "" : "s"} name${enforcement.length === 1 ? "s" : ""} it` : null,
  ]);

  // The reputation record, counted by how sure we are of each dimension — the honest shape of the
  // section, since "we don't know" is as common an answer there as "yes" and must read as one.
  const repEstablished = reputation ? reputation.dimensions.filter((d) => d.status === "established").length : 0;
  const repDisputed = reputation ? reputation.dimensions.filter((d) => d.status === "disputed").length : 0;
  const repUnknown = reputation ? reputation.dimensions.filter((d) => d.status === "unknown").length : 0;

  // Jump-nav. Every target below is now rendered unconditionally except the alert group, so these
  // anchors can no longer point at a section that isn't there (the old "Enforcement" chip jumped to
  // an empty div, and "Buyers" broke whenever only the community signal existed).
  const nav = [
    { id: "verdict", label: "Verdict" },
    hasAlerts ? { id: "alerts", label: "Alerts" } : null,
    { id: "reputation", label: "Evidence" },
    { id: "lab-tests", label: "Lab tests" },
    { id: "trackers", label: "Trackers" },
    { id: "signals", label: "Storefront" },
    { id: "reviews", label: "Buyers" },
    { id: "enforcement", label: "Regulators" },
    { id: "network", label: "Who owns it" },
    { id: "catalog", label: "Catalog" },
    { id: "history", label: "History" },
  ].filter((x): x is { id: string; label: string } => Boolean(x));

  return (
    <>
      {/* The vendor as an organization. No aggregateRating and no review: the VialGrade letter is
          our own derived verdict over evidence seams, not customers rating a seller, and shipping
          it as a star rating would both invent review data and read as an endorsement. */}
      <JsonLd data={vendorSchema({ slug, name: vendor.name, description: vendor.description, location: vendor.location, founded: vendor.founded })} />

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
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-bold text-white">{vendorClaimLabel(vendor.profileStatus)}</span>
                  <DataOriginBadge origin={vendor.origin} />
                </div>
                <h1 className="mt-4 text-balance text-[clamp(2rem,4.2vw,3.25rem)] font-extrabold leading-[.95] tracking-[-.04em]">{vendor.name}</h1>
                <p className="mt-4 max-w-xl text-[15px] font-medium leading-7 text-white/75">{vendor.description}</p>
                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-semibold text-white/65">
                  {vendor.location && <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" /> {vendor.location}</span>}
                  {vendor.founded && <span className="inline-flex items-center gap-1.5"><Building2 className="size-4" /> Founded {vendor.founded}</span>}
                  {vendor.lastObserved && <span className="inline-flex items-center gap-1.5"><Clock3 className="size-4" /> Updated {vendor.lastObserved}</span>}
                </div>
                <div className="mt-6"><FollowButton entityType="vendor" entitySlug={slug} initialFollowed={followed} authenticated={Boolean(principal)} /></div>
              </div>
            </div>

            {/* the bottom line — the headline grade, its reason, and the dimensions it rests on */}
            <VialGradeCard grade={grade} summary={composed.summary} />
          </div>

          {/* at-a-glance stats */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            <HeroStat icon={FlaskConical} value={String(vendor.coaCount)} label="Independent lab tests" />
            <HeroStat icon={ShieldCheck} value={vendor.medianPurity != null ? `${vendor.medianPurity.toFixed(1)}%` : "—"} label="Median tested purity" />
            <HeroStat icon={PackageSearch} value={String(secondaryValue)} label={secondaryLabel} />
            <HeroStat
              icon={priceIndex.medianPctVsMarket ? (priceIndex.medianPctVsMarket > 0 ? TrendingUp : TrendingDown) : Tag}
              value={priceIndex.medianPctVsMarket != null ? `${priceIndex.medianPctVsMarket > 0 ? "+" : ""}${priceIndex.medianPctVsMarket}%` : "—"}
              label="Typical price vs market"
              accent={!priceIndex.medianPctVsMarket ? undefined : priceIndex.medianPctVsMarket < 0 ? "#0e8f80" : "#d3372c"}
            />
            <HeroStat icon={Star} value={vendor.reviewCount > 0 ? String(vendor.reviewCount) : "—"} label="Buyer reviews on file" />
          </div>
          {vendor.medianPurity != null && <p className="mt-3 text-[11px] font-medium leading-4 text-white/55">{PURITY_PROVENANCE_SHORT} <Link href="/grades" className="font-bold text-[#8fa2ff] underline underline-offset-2">Purity vs grade</Link></p>}
        </div>
      </section>

      {/* ── Upstream-manufacturer context ───────────────────────────────────────────────
          This used to render only when a vendor happened to also have an alert, so the single most
          important framing fact about a manufacturer page — that it is not a shop — was invisible on
          the clean ones. It reframes everything below it, so it goes first and unconditionally. */}
      {maker && (
        <div className="mx-auto max-w-[1320px] px-5 pt-10 sm:px-8">
          <p className="ink hard-sm rounded-[18px] bg-[#fff6e6] p-5 text-sm font-medium leading-6 text-[#111214]"><span className="font-extrabold">Upstream manufacturer, not a storefront.</span> We surfaced {vendor.name} from third-party lab records &mdash; the party a certificate names as having made or ordered the tested material, not a shop you buy from directly. Treat its test history as upstream intelligence.</p>
        </div>
      )}

      {/* ── The answer, up front ─────────────────────────────────────────────────────────
          The question the reader arrived with, answered in the first two sentences under it, then
          decomposed into the checks it rests on. Every clause is a count rendered further down. */}
      <section id="verdict" className="mx-auto max-w-[1320px] scroll-mt-24 px-5 pt-12 sm:px-8">
        <SectionHead eyebrow="The bottom line" title={headlineQuestion} note={`Based on ${composed.weighed} check${composed.weighed === 1 ? "" : "s"}. ${composed.verifiedCount > 0 ? `${composed.verifiedCount} backed by a document.` : "None backed by a document."}`} />
        {/* The answer, in one quotable sentence, immediately under the question. It deliberately does
            NOT repeat the grade card's summary sentence a few hundred pixels above — it names the
            evidence the verdict is standing on instead, which is the part a reader can go check. */}
        <p className="mt-5 max-w-3xl text-[17px] font-medium leading-7 text-[#111214]">
          <span className="font-extrabold">{grade.headline}.</span> What that rests on: {restsOn}.
        </p>
        <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">
          Nothing here says a product is safe to use, and nothing here is an endorsement &mdash; VialGrade sells nothing and takes no money from vendors. Where we hold no evidence, the section below says so plainly instead of disappearing.
        </p>

        <h3 className="mt-10 text-[clamp(1.15rem,2vw,1.45rem)] font-extrabold tracking-[-.03em]">Which checks did we run, and what did each one find?</h3>
        <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">Every seam we hold on {vendor.name}, in one place &mdash; each one comes from something you can read further down this page. The grade above is a summary of this list, not a replacement for it: a good result and a bad one both stay visible instead of cancelling each other out. We mark each one: <span className="font-bold text-[#0a6b60]">Confirmed</span> (we have the document), <span className="font-bold text-[#2b31d8]">Reported</span> (someone else said it), or <span className="font-bold text-black/55">Our guess</span>.</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {composed.factors.map((f) => (
            <div key={f.label} className={`ink-1 flex items-start gap-3 rounded-[16px] p-4 ${f.ok === false ? "bg-[#fff5f4]" : f.ok === true ? "bg-[#f2fdfa]" : "bg-white"}`}>
              <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-md ${f.ok === true ? "bg-[#12b3a6] text-white" : f.ok === false ? "bg-[#f5463d] text-white" : "bg-[#111214]/[.06] text-black/45"}`}>
                {f.ok === true ? <Check className="size-3.5" /> : f.ok === false ? <X className="size-3.5" /> : <CircleDashed className="size-3.5" />}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-[13px] font-extrabold tracking-[-.01em]">{signalLabel(f.label)}</p>
                  {f.confidence && <TierChip tier={f.confidence} />}
                </div>
                <p className="mt-0.5 text-[13px] font-medium leading-5 text-[var(--muted)]">{f.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Alerts: grouped, only when present ──────────────────────────────────────── */}
      {hasAlerts && (
        <section id="alerts" className="mx-auto max-w-[1320px] scroll-mt-24 space-y-4 px-5 pt-12 sm:px-8">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#d3372c]">Read this first</p>
            <h2 className="mt-3 text-[clamp(1.5rem,3vw,2.1rem)] font-extrabold leading-[1.02] tracking-[-.035em]">What is flagged on {vendor.name} right now?</h2>
            <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">Enough to change how you read the rest of this page: {alertReasons}. Each one is a record we can show you, not our opinion &mdash; the detail and its source are below.</p>
          </div>
          {statusAlert && <VendorStatusBanner status={statusAlert} vendorName={vendor.name} />}
          {vendorFlags.length > 0 && <VendorFlagsBanner flags={vendorFlags} vendorName={vendor.name} />}
          {enforcement.length > 0 && <EnforcementBanner actions={enforcement} vendorName={vendor.name} />}
        </section>
      )}

      {/* ── Sticky jump-nav ─────────────────────────────────────────────────────────── */}
      <JumpNav items={nav} />

      {/* ── Evidence ──────────────────────────────────────────────────────────────────
          Every section below renders whether or not we hold the evidence for it. A missing section
          reads as "nothing to see here"; the honest answer is "nobody has published this", and that
          gap is the single most useful thing this site can tell a buyer. */}
      <section id="reputation" className="mx-auto max-w-[1320px] scroll-mt-24 px-5 pt-14 sm:px-8">
        <SectionHead eyebrow="Evidence, check by check" title="Where does the evidence hold up, and where is it missing?" />
        {reputation ? (
          <>
            <p className="mt-4 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">
              Of the {reputation.dimensions.length} things we check on a vendor, {repEstablished} {repEstablished === 1 ? "is" : "are"} backed by evidence we can point at, {repDisputed} {repDisputed === 1 ? "needs" : "need"} a closer look, and {repUnknown} we simply don&rsquo;t know. Each card says which, and where it came from.
            </p>
            <div className="mt-7"><VendorReputationTiles dimensions={reputation.dimensions} /></div>
            <p className="mt-5 max-w-3xl text-xs font-medium leading-5 text-[var(--muted)]">Each answer stands on its own and says where it came from. Where we don&rsquo;t have the evidence, it says so &mdash; we never invent a number or blend everything into one score.</p>
          </>
        ) : (
          <NoEvidence
            answer={`We haven’t built a check-by-check reputation record for ${vendor.name} yet.`}
            note="That record is assembled from lab reports, shipping history, buyer reviews and fraud-case records. Until it exists, read the individual sections below on their own — an absent record is a gap in what we hold, not a finding about the vendor."
          />
        )}
      </section>

      <div id="lab-tests" className="scroll-mt-24">
        {vendorLabTests.length > 0 ? (
          <LabTestsPanel tests={vendorLabTests} heading={`Has anyone independently tested ${vendor.name}?`} />
        ) : (
          <section className="mx-auto max-w-[1320px] px-5 pt-14 sm:px-8">
            <SectionHead eyebrow="Independent testing" title={`Has anyone independently tested ${vendor.name}?`} />
            <NoEvidence
              answer={`No independent lab certificate for ${vendor.name} is on record with us.`}
              note="We read certificates from the public feeds independent labs publish and from the certificates vendors post themselves. Neither has produced one for this vendor. That is not evidence against them — it means nobody has published a test we can read, so there is nothing here to check a claim against. Unknown is not the same as clean."
            />
          </section>
        )}
      </div>

      <div id="trackers" className="scroll-mt-24">
        {aggregatorRatings.length > 0 ? (
          <AggregatorRatingsPanel ratings={aggregatorRatings} vendorName={vendor.name} />
        ) : (
          <section className="mx-auto max-w-[1320px] px-5 pt-14 sm:px-8">
            <SectionHead eyebrow="Third-party aggregators" title={`What do other trackers say about ${vendor.name}?`} />
            <NoEvidence
              answer={`No independent peptide tracker we follow has published a rating for ${vendor.name}.`}
              note="We read the ratings other aggregators publish and show them side by side with a link to each source. None of them covers this vendor, so there is no second opinion to compare ours against."
            />
          </section>
        )}
      </div>

      <div id="signals" className="scroll-mt-24">
        {vendorSignals ? (
          <VendorSignalsPanel signals={vendorSignals} vendorName={vendor.name} />
        ) : (
          <section className="mx-auto max-w-[1320px] px-5 pt-14 sm:px-8">
            <SectionHead eyebrow="Operational signals" title={`What does ${vendor.name}’s own storefront tell us?`} />
            <NoEvidence
              answer={`We haven’t read ${vendor.name}’s own site into a record yet.`}
              note="This section normally carries neutral facts from the vendor's public site and domain records — how old the domain is, which payment rails it takes, whether it posts a research-use-only notice. None of it proves what is in a vial, and right now we hold none of it for this vendor."
            />
          </section>
        )}
      </div>

      <div id="reviews" className="scroll-mt-24">
        {vendorReview ? (
          <VendorReviewsPanel review={vendorReview} vendorName={vendor.name} />
        ) : (
          <section className="mx-auto max-w-[1320px] px-5 pt-14 sm:px-8">
            <SectionHead eyebrow="What buyers say" title={`What do buyers report about ${vendor.name}?`} />
            <NoEvidence
              answer={`We haven’t gathered a buyer-review record for ${vendor.name}.`}
              note="We collect buyer reports from public web sources and weight them toward specific, reproducible failures over generic praise. Nothing has been gathered for this vendor yet — silence here is an absence of information, not an absence of problems."
            />
          </section>
        )}
        {communitySignal ? (
          <CommunitySignalCard signal={communitySignal} vendorName={vendor.name} />
        ) : (
          <section className="mx-auto max-w-[1320px] px-5 pt-14 sm:px-8">
            <SectionHead eyebrow="Community" title={`What does r/Peptides say about ${vendor.name}?`} />
            <NoEvidence
              answer={`No r/Peptides discussion for ${vendor.name} has been captured.`}
              note="Real vendors usually get talked about. An absence of mentions is a mild signal worth noticing — it is not a clean bill of health, and it is not proof the vendor is new or fake either."
            />
          </section>
        )}
      </div>

      {/* Regulators get their own section even when the answer is "nothing on file" — that is the
          answer most readers came for, and the jump-nav chip used to land on an empty div. When
          there IS a record, the full detail stays in the alert at the top rather than being
          repeated here, because the alarm belongs above the fold. */}
      <section id="enforcement" className="mx-auto max-w-[1320px] scroll-mt-24 px-5 pt-14 sm:px-8">
        <SectionHead eyebrow="Regulators" title={`Has any regulator taken action against ${vendor.name}?`} />
        {enforcement.length > 0 ? (
          <div className="ink hard mt-6 rounded-[20px] bg-[#fff1f0] p-6">
            <p className="text-base font-extrabold leading-6">Yes &mdash; {enforcement.length} public record{enforcement.length === 1 ? "" : "s"} name{enforcement.length === 1 ? "s" : ""} {vendor.name}, or an operator we matched to it.</p>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#111214]/70">Each agency, action type, outcome and a link to the original document {enforcement.length === 1 ? "is" : "are"} at the <a href="#alerts" className="font-bold underline underline-offset-2">top of this page</a>. We report the action and link the source; we do not add an accusation of our own.</p>
          </div>
        ) : (
          <NoEvidence
            answer={`No FDA, DOJ or FTC enforcement or recall record is on file for ${vendor.name}.`}
            note="We check public agency records for actions naming this vendor or an operator matched to it, and found none. An absent record is not a clean bill of health: most sellers in this market have never been the subject of a public action, and enforcement lags the market by years."
          />
        )}
      </section>

      {vendorOffers.length > 0 && <VendorOffersPanel offers={vendorOffers} vendorName={vendor.name} />}
      <div id="network" className="scroll-mt-24"><VendorLinksPanel links={vendorLinks} vendorName={vendor.name} /></div>

      {/* ── Catalog + history ───────────────────────────────────────────────────────── */}
      {catalogStale && (
        <div className="ink-1 hard mx-auto mt-8 flex max-w-[1320px] items-start gap-3 rounded-[16px] bg-[#fff4e0] p-5 text-sm font-medium leading-6 text-[#b26a00]">
          <CircleDashed className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong className="font-extrabold">These prices may be out of date.</strong> We last read this
            vendor&rsquo;s store {staleDays} days ago and haven&rsquo;t been able to since &mdash; some storefronts
            block automated checks. Treat the prices below as last-seen, not current, and confirm on their site.
          </span>
        </div>
      )}
      <section id="catalog" className="mx-auto max-w-[1320px] scroll-mt-24 px-5 py-16 sm:px-8 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
          <div>
            {listings.length > 0 ? (
              <>
                <SectionHead eyebrow="Catalog" title={`What does ${vendor.name} sell, and at what price?`} note={priceIndex.medianPctVsMarket == null ? undefined : priceIndex.medianPctVsMarket < 0 ? "typically below market" : priceIndex.medianPctVsMarket > 0 ? "typically above market" : "around market rate"} />
                <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-[var(--muted)]">
                  {listings.length} listing{listings.length === 1 ? "" : "s"} we have read from their store, cheapest per milligram first{priceIndex.medianPctVsMarket != null ? `, priced ${Math.abs(priceIndex.medianPctVsMarket)}% ${priceIndex.medianPctVsMarket < 0 ? "below" : priceIndex.medianPctVsMarket > 0 ? "above" : "at"} the market median across ${priceIndex.comparedCount} comparable listing${priceIndex.comparedCount === 1 ? "" : "s"}` : ", with too few priced peers to compare against the market"}. A price is not evidence of quality either way.
                </p>
                <div className="mt-7 grid gap-5 sm:grid-cols-2">{catalogSorted.map((product) => <ProductCard key={product.slug} product={product} />)}</div>
              </>
            ) : (
              <>
                <SectionHead eyebrow="Catalog" title={`What does ${vendor.name} sell, and at what price?`} />
                <NoEvidence
                  answer="We haven’t captured a shoppable catalog for this vendor."
                  note={`We track ${vendor.name} from lab records and public sources, but haven’t read a live storefront catalog${maker ? " — it’s an upstream manufacturer, not a shop" : ""}. There are no prices here to compare against the market.`}
                />
              </>
            )}
          </div>

          <aside id="history" className="scroll-mt-24">
            <div className="ink-1 hard sticky top-28 rounded-[20px] bg-white p-5">
              <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#2b31d8]">History</p>
              <h2 className="mt-2 text-[15px] font-extrabold tracking-[-.02em]">What has changed recently?</h2>
              <p className="mt-2 text-xs font-medium leading-5 text-[var(--muted)]">
                {vendor.history.length > 0
                  ? `${vendor.history.length} change${vendor.history.length === 1 ? "" : "s"} we have recorded for ${vendor.name} — catalog, documents, profile and policy.`
                  : `We haven’t recorded any change for ${vendor.name} yet.`}
              </p>
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

// The state a section takes when we hold no evidence for it. It carries the plain answer first, so
// the section stays independently readable, then why the gap exists — never a claim about the
// vendor. A visible "we don't know" is the product; a silently dropped section is not.
function NoEvidence({ answer, note }: { answer: string; note: string }) {
  return (
    <div className="mt-6 rounded-[20px] border-2 border-dashed border-[#111214]/25 bg-white/50 p-6">
      <p className="flex items-start gap-2.5 text-base font-extrabold leading-6 text-[#111214]"><CircleDashed className="mt-0.5 size-4 shrink-0 text-[#111214]/35" />{answer}</p>
      <p className="mt-2 max-w-2xl pl-[26px] text-sm font-medium leading-6 text-[var(--muted)]">{note}</p>
    </div>
  );
}

function HeroStat({ icon: Icon, value, label, accent }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; value: string; label: string; accent?: string }) {
  return <div className="ink hard rounded-[16px] bg-white p-4 text-[#111214]"><Icon className="size-4" style={{ color: accent ?? "#39414e" }} /><p className="mt-3 text-2xl font-extrabold tracking-[-.04em]" style={accent ? { color: accent } : undefined}>{value}</p><p className="mt-0.5 text-[11px] font-semibold leading-4 text-[var(--muted)]">{label}</p></div>;
}

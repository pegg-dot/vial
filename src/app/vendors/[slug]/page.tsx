import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { evidenceOnlyPublicRelease, hidesCommerce, publicBrowseRelease } from "@/lib/public-research-release";
import { ResearchScopeNotice } from "@/components/research-scope-notice";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { CATALOG_CACHE_TAG } from "@/server/catalog/repository";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CircleDashed, Factory, FileCheck2, FlaskConical, Gavel, PackageSearch, ShieldCheck, Star, Store, Tag, TrendingDown, TrendingUp, X } from "lucide-react";
import { getCatalogSnapshot, getProductsByVendorSlug, getVendorBySlug } from "@/server/catalog/repository";
import { vendorPriceIndex } from "@/lib/curation";
import { daysSince } from "@/lib/format";
import { getVendorReputationBySlug } from "@/server/reputation/repository";
import { vendorClaimLabel } from "@/lib/vendor-copy";
import { PURITY_PROVENANCE_SHORT } from "@/lib/provenance-copy";
import { TierChip } from "@/components/signal-tier-chip";
import { signalLabel } from "@/lib/signal-copy";
import { CatalogGrid } from "@/components/catalog-grid";
import { VendorMark } from "@/components/vendor-mark";
import { DataOriginBadge } from "@/components/data-origin-badge";
import { checkContent } from "@/server/verify/content-check";
import { composeVerdict } from "@/server/verify/trust-graph";
import { gradeFromVerdict } from "@/server/verify/grade";
import { persistVendorGrade } from "@/server/verify/grade-store";
import { VialGradeCard } from "@/components/vial-grade-card";
import { getVendorRegulatoryActions } from "@/server/regulatory/repository";
import { EnforcementBanner } from "@/components/enforcement-banner";
import { VendorHistoryRail } from "@/components/vendor-history-rail";
import { FollowButton } from "@/components/follow-button";
import { getCurrentPrincipal } from "@/server/auth/principal";
import { listFollows } from "@/server/consumer-intelligence/repository";
import { CommunitySignalCard } from "@/components/community-signal-card";
import { getStoredCommunitySignal } from "@/server/ingest/reddit";
import { getDatabase } from "@/server/db/client";
import { getVendorDomain } from "@/server/vendors/domain";
import { vendorLinkAllowed, vendorLinksReleased, vendorSourceUrl } from "@/lib/vendor-source-link";
import { VendorSourceLink } from "@/components/vendor-source-link";
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
import { getVendorAggregatorRatings, getVendorSignals, getVendorOffers, getVendorNews } from "@/server/external/repository";
import { AggregatorRatingsPanel } from "@/components/aggregator-ratings-panel";
import { VendorSignalsPanel } from "@/components/vendor-signals-panel";
import { VendorOffersPanel } from "@/components/vendor-offers-panel";
import { VendorNewsPanel } from "@/components/vendor-news-panel";
import { JumpNav } from "@/components/vendor-report-chrome";
import { Chip, Notice, NumberedSection, PageHero, Pill, Quiet, Section, StatRow, UI } from "@/components/intelligence/research-ui";
import { JsonLd } from "@/components/json-ld";
import { vendorSchema } from "@/lib/structured-data";

export const dynamic = "force-dynamic";

// The plain words for a gathered-review verdict, matching the labels the reviews panel prints, so
// the summary at the top and the section further down can never say two different things.
const REVIEW_PLAIN: Record<string, string> = {
  positive: "mostly positive", mixed: "mixed", negative: "mostly negative",
  scam: "unverified adverse allegations", unknown: "no clear signal",
};

// The sections that leave with the catalog under the evidence-only release: offers, trackers, the
// storefront read, buyer reports and the catalog itself. Nothing on this list may render there.
const COMMERCE_SECTIONS = new Set(["offers", "trackers", "signals", "reviews", "catalog"]);

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
  // Metadata requests can run separately from the page. In research-only production mode the page
  // is readable only under the browse release, and then it carries the vendor's name and nothing
  // else of the seller record: an evidence-record title, never indexed. With browsing off the page
  // redirects, so the catalog is not read at all.
  if (evidenceOnlyPublicRelease()) {
    const robots = { index: false, follow: false };
    if (!publicBrowseRelease()) return { robots };
    const vendor = await getVendorBySlug(slug);
    // `absolute` keeps the root layout's " · VialGrade" template off a title that already names the site.
    return vendor ? { title: { absolute: `${vendor.name} evidence record | VialGrade` }, robots } : { robots };
  }
  const vendor = await getVendorBySlug(slug);
  if (!vendor) return {};
  // The title is the question a reader actually types. A question asserts nothing — which is the
  // only honest way to head a page about whether a seller can be trusted. The root layout appends
  // " · VialGrade", so this half stays short.
  // "Is X legit?" is only an honest title where the page can answer it. A vendor with nothing
  // listed is graded as a maker, not a shop (see `gradeFromVerdict`) — the same predicate is used
  // for the page's own headline, so the tab title and the h2 can never ask different questions.
  const title = `${vendor.name}: public laboratory and vendor evidence`;
  // The description states the evidence position we actually hold — read off the materialized
  // grade and the real counts on the vendor row, so anything quoting it quotes the real thing.
  // `vendor` comes from the cached catalog snapshot, so none of this costs an extra query.
  const evidence = [
    vendor.coaCount > 0 ? `${vendor.coaCount} independent lab test${vendor.coaCount === 1 ? "" : "s"} on record` : "no independent lab test on record",
    vendor.medianPurity != null ? `${vendor.medianPurity.toFixed(1)}% median tested purity` : null,
    vendor.reviewCount > 0 ? `${vendor.reviewCount} buyer-reputation record${vendor.reviewCount === 1 ? "" : "s"}` : "no buyer-reputation record on file",
  ].filter(Boolean).join(", ");
  const description = `Evidence on file: ${evidence}. Dated laboratory, regulatory and vendor records for ${vendor.name}. Reports do not establish authenticity, safety, legality or reliable delivery.`;
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
    const [listings, catalog, reputation, communitySignal, vendorLabTests, vendorFlags, vendorLinks, vendorReview, vendorStatus, enforcement, aggregatorRatings, vendorSignals, vendorOffers, vendorNews] = await Promise.all([getProductsByVendorSlug(slug), getCatalogSnapshot(), getVendorReputationBySlug(slug), getDatabase().then((db) => getStoredCommunitySignal(db, slug)), getDatabase().then((db) => getLabTestsForVendor(db, slug, 24)), getDatabase().then((db) => getVendorFlags(db, slug)), getDatabase().then((db) => getVendorLinks(db, slug)), getDatabase().then((db) => getVendorReview(db, slug)), getDatabase().then((db) => getVendorStatus(db, slug)), getDatabase().then((db) => getVendorRegulatoryActions(slug, db)), getDatabase().then((db) => getVendorAggregatorRatings(slug, db)), getDatabase().then((db) => getVendorSignals(slug, db)), getDatabase().then((db) => getVendorOffers(slug, db)), getDatabase().then((db) => getVendorNews(slug, db))]);
    return { listings, catalog, reputation, communitySignal, vendorLabTests, vendorFlags, vendorLinks, vendorReview, vendorStatus, enforcement, aggregatorRatings, vendorSignals, vendorOffers, vendorNews };
  },
  ["vendor-page"],
  { tags: [CATALOG_CACHE_TAG], revalidate: 21600 },
);

export default async function VendorPage({ params }: { params: Promise<{ slug: string }> }) {
  if (evidenceOnlyPublicRelease() && !publicBrowseRelease()) redirect("/intelligence");
  // Browsing a vendor under the evidence-only release shows its grade, lab evidence, regulatory records
  // and history. No catalog, prices, offers, buyer reviews, community posts or follow button.
  const noCommerce = hidesCommerce();
  const { slug } = await params;
  const vendor = await getVendorBySlug(slug);
  if (!vendor) notFound();
  const [publicData, principal] = await Promise.all([loadVendorPublicData(slug), getCurrentPrincipal()]);
  const { listings, catalog, reputation, communitySignal, vendorLabTests, vendorFlags, vendorLinks, vendorReview, vendorStatus, enforcement, aggregatorRatings, vendorSignals, vendorOffers, vendorNews } = publicData;
  // How this vendor's per-mg pricing sits against the market (the "are they a good deal?" stat).
  const priceIndex = vendorPriceIndex(listings, catalog.products);
  // Order documentary snapshots by observation date, not purchasing value.
  const catalogSorted = [...listings].sort((a, b) => (b.observedAt ?? "").localeCompare(a.observedAt ?? "") || a.slug.localeCompare(b.slug));
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
    status: vendorStatus ? { status: vendorStatus.status, consecutiveFailures: vendorStatus.consecutiveFailures ?? 0 } : null,
    // Read from the certificates already loaded above. Omitting these is what made this page
    // publish a dose-blind verdict AND write it over the correct one.
    underdosedCount: vendorLabTests.filter((t) => checkContent(t.sample_name ?? "", t.measured_content ?? null).verdict === "underdosed").length,
    overfilledCount: vendorLabTests.filter((t) => checkContent(t.sample_name ?? "", t.measured_content ?? null).verdict === "overfilled").length,
    flagCount: vendorFlags.length,
  });
  // The headline letter is a projection of the verdict above — same seams, no second opinion.
  //
  // Computed live HERE, because this page has already loaded every seam. Market cards and product
  // pages read the MATERIALIZED copy on the vendor row instead (deriving it there would cost ~10
  // queries per card). They must never disagree, so this page writes its result back: this is the
  // definition of the grade, and everywhere else is a cache of it.
  const grade = gradeFromVerdict(composed, { coaCount: vendor.coaCount, listingCount: vendor.productCount, vendorKind: vendor.kind });
  await persistVendorGrade(slug, grade, composed.summary).catch(() => {});

  // Only the going-dark states produce a banner (`VendorStatusBanner` renders nothing for "blocked"
  // or "unknown"). Keying the alert group off `status !== "operating"` instead used to open an empty
  // section — harmless while it was invisible, but the group now carries a heading that states what
  // is wrong, and a heading must never claim something the page then fails to show.
  const statusAlert = vendorStatus && ["offline", "parked", "closed", "redirected"].includes(vendorStatus.status) ? vendorStatus : null;
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

  const maker = vendor.kind === "manufacturer";
  // A plain, labeled link to the company's own site. Off by default; never for avoid/high-risk
  // verdicts or dead storefronts; not tracked and not routed through /go.
  const sourceUrl = vendorLinksReleased() && vendorLinkAllowed({ verdict: composed.verdict, status: vendorStatus?.status ?? null })
    ? vendorSourceUrl(await getVendorDomain(await getDatabase(), slug).catch(() => null))
    : null;
  const strongLinks = vendorLinks.filter((l) => l.strength === "strong");
  const blindTests = vendorLabTests.filter((t) => t.is_blind).length;

  // The heading this whole page exists to answer, in the words the reader used. It is a question on
  // purpose: a question matches what was asked without asserting that the answer is "yes".
  //
  // "Is X legit?" is only asked where the page can answer it. A vendor with nothing listed is graded
  // as a maker rather than a shop (`gradeFromVerdict` keys off exactly this), so asking whether to
  // buy from them would head the page with a question its own verdict then refuses.
  const headlineQuestion = `What evidence is on record for ${vendor.name}?`;

  // One sentence naming every seam the verdict rests on. Each clause is a count this page renders
  // further down — nothing new is derived here, so the summary can never drift from the sections.
  // Buyer reports and community mentions are hidden under the evidence-only release, so the
  // sentence must not name them there: a clause is only allowed in when its section is.
  const restsOn = joinList([
    vendor.coaCount > 0
      ? `${vendor.coaCount} independent lab test${vendor.coaCount === 1 ? "" : "s"} on record${blindTests > 0 ? ` (${blindTests} of them blind)` : ""}`
      : "no independent lab test on record",
    enforcement.length > 0
      ? `${enforcement.length} public regulatory record${enforcement.length === 1 ? "" : "s"}`
      : "no FDA, DOJ or FTC enforcement record on file",
    vendorFlags.length > 0 ? `${vendorFlags.length} certificate-integrity flag${vendorFlags.length === 1 ? "" : "s"}` : null,
    strongLinks.length > 0 ? `shared identifiers with ${strongLinks.length} other storefront${strongLinks.length === 1 ? "" : "s"}` : null,
    noCommerce ? null : vendorReview ? `buyer reports that read ${REVIEW_PLAIN[vendorReview.sentiment] ?? "unclear"}` : "no buyer-review record gathered yet",
    noCommerce ? null : communitySignal ? `${communitySignal.mention_count} r/Peptides mention${communitySignal.mention_count === 1 ? "" : "s"}` : null,
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

  // One ordered list for the whole report, in document order. The jump-nav reads it for its chips
  // and every section takes its number from its place in it, so the bar and the frames can never
  // count differently. Conditional entries are left out rather than rendered empty (the old
  // "Enforcement" chip jumped to an empty div, and "Buyers" broke whenever only the community
  // signal existed), and the commerce sections leave with their content under the evidence-only
  // release — a chip that scrolls to nothing is worse than no chip.
  const sections = [
    { id: "verdict", label: "Verdict" },
    hasAlerts ? { id: "alerts", label: "Alerts" } : null,
    { id: "reputation", label: "Evidence" },
    { id: "lab-tests", label: "Lab tests" },
    { id: "trackers", label: "Trackers" },
    { id: "signals", label: "Storefront" },
    { id: "reviews", label: "Buyers" },
    { id: "enforcement", label: "Regulators" },
    // Conditional for the same reason the alert chip is: most vendors have no coverage on file.
    vendorNews.length > 0 ? { id: "news", label: "In the news" } : null,
    vendorOffers.length > 0 ? { id: "offers", label: "Offers" } : null,
    { id: "network", label: "Who owns it" },
    { id: "catalog", label: "Catalog" },
    { id: "history", label: "History" },
  ].filter((x): x is { id: string; label: string } => Boolean(x) && !(noCommerce && COMMERCE_SECTIONS.has(x!.id)));
  const number = (id: string) => sections.findIndex((s) => s.id === id) + 1;

  // The masthead figures. "Listings" is a catalog count, so under the evidence-only release every
  // vendor shows its batch test records in that slot instead — the hero never counts what the page
  // does not show. The price delta is the only coloured figure, and only outside that release.
  const stats = [
    { icon: FlaskConical, value: vendor.coaCount, label: "Independent lab tests" },
    { icon: ShieldCheck, value: vendor.medianPurity != null ? `${vendor.medianPurity.toFixed(1)}%` : "—", label: "Median tested purity" },
    noCommerce || vendor.kind !== "storefront"
      ? { icon: FileCheck2, value: vendor.passportCount, label: "Batch test records" }
      : { icon: PackageSearch, value: vendor.productCount, label: "Listings" },
    ...(noCommerce ? [] : [
      {
        icon: priceIndex.medianPctVsMarket ? (priceIndex.medianPctVsMarket > 0 ? TrendingUp : TrendingDown) : Tag,
        value: priceIndex.medianPctVsMarket != null
          ? <span className={!priceIndex.medianPctVsMarket ? "" : priceIndex.medianPctVsMarket < 0 ? "text-[#0b6b60]" : "text-[#ce403b]"}>{priceIndex.medianPctVsMarket > 0 ? "+" : ""}{priceIndex.medianPctVsMarket}%</span>
          : "—",
        label: "Typical price vs market",
      },
      { icon: Star, value: vendor.reviewCount > 0 ? vendor.reviewCount : "—", label: "Buyer reviews on file" },
    ]),
  ];
  const whereAndWhen = [vendor.location, vendor.founded ? `Founded ${vendor.founded}` : null, vendor.lastObserved ? `Updated ${vendor.lastObserved}` : null].filter(Boolean).join(" · ");

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      {/* The vendor as an organization. No aggregateRating and no review: the VialGrade letter is
          our own derived verdict over evidence seams, not customers rating a seller, and shipping
          it as a star rating would both invent review data and read as an endorsement. */}
      <JsonLd data={vendorSchema({ slug, name: vendor.name, description: vendor.description, location: vendor.location, founded: vendor.founded })} />

      {/* ── Report header: paper hero, the tier-coloured grade card as its aside — a rating letter
          stamped beside a white tearsheet. The market crumb carries its #browse hash: the browse
          release bans any `main` href that ends in "/market". ─────────────────────────── */}
      <PageHero art={["magnifier", "coa"]}
        breadcrumb={[{ href: "/intelligence/market#browse", label: "Research Market" }, { href: "/vendors", label: "Vendors" }, { label: vendor.name }]}
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            <Chip tone="blue" icon={maker ? Factory : Store}>{maker ? "Manufacturer" : "Storefront"}</Chip>
            <Chip tone="paper" plain className="normal-case tracking-normal">{vendorClaimLabel(vendor.profileStatus)}</Chip>
            <DataOriginBadge origin={vendor.origin} />
          </span>
        }
        title={<span className="flex items-center gap-4"><VendorMark initials={vendor.initials} accent={vendor.accent} size="lg" /><span>{vendor.name}</span></span>}
        lead={vendor.description}
        note={whereAndWhen || undefined}
        actions={<>
          <Pill href="#lab-tests" variant="primary" arrow="right">Independent lab tests</Pill>
          <Pill href="/vendors" variant="ghost" icon={ArrowLeft}>All vendors</Pill>
          {noCommerce ? null : <FollowButton entityType="vendor" entitySlug={slug} entityName={vendor.name} initialFollowed={followed} />}
        </>}
        aside={<VialGradeCard grade={grade} summary={composed.summary} vendorName={vendor.name} />}
      >
        <StatRow className="mt-8" items={stats} />
        {vendor.medianPurity != null && <p className={UI.small + " mt-3 max-w-2xl"}>{PURITY_PROVENANCE_SHORT} <Link href="/grades" className={UI.linkSmall}>Purity vs grade <ArrowRight className="size-3.5" aria-hidden="true" /></Link></p>}
      </PageHero>

      {sourceUrl ? <VendorSourceLink url={sourceUrl} /> : null}
      <ResearchScopeNotice />

      <Section tight className="grid gap-4">
        {/* ── Upstream-manufacturer context ─────────────────────────────────────────────
            This used to render only when a vendor happened to also have an alert, so the single most
            important framing fact about a manufacturer page — that it is not a shop — was invisible on
            the clean ones. It reframes everything below it, so it goes first and unconditionally. */}
        {maker && (
          <Notice tone="warn" icon={Factory}>
            <p><span className="font-extrabold">Upstream manufacturer, not a storefront.</span> We surfaced {vendor.name} from third-party lab records &mdash; the party a certificate names as having made or ordered the tested material, not a shop you buy from directly. Treat its test history as upstream intelligence.</p>
          </Notice>
        )}

        {/* ── The answer, up front ───────────────────────────────────────────────────────
            The question the reader arrived with, answered in the first two sentences under it, then
            decomposed into the checks it rests on. Every clause is a count rendered further down. */}
        <NumberedSection id="verdict" number={number("verdict")} eyebrow="The bottom line" title={headlineQuestion}
          intro={`Based on ${composed.weighed} check${composed.weighed === 1 ? "" : "s"}. ${composed.verifiedCount > 0 ? `${composed.verifiedCount} backed by a document.` : "None backed by a document."}`}>
          {/* The answer, in one quotable sentence, immediately under the question. It deliberately does
              NOT repeat the grade card's summary sentence a few hundred pixels above — it names the
              evidence the verdict is standing on instead, which is the part a reader can go check. */}
          <p className="max-w-3xl text-[15px] font-medium leading-6 text-[#111214]">
            <span className="font-extrabold">{grade.headline}.</span> What that rests on: {restsOn}.
          </p>
          <p className={UI.body + " max-w-3xl"}>
            This grade describes documented observations only. It is not a determination of product safety, vendor legality, shipment authenticity, or whether a transaction should occur. Missing evidence stays visible.
          </p>

          <h3 className={UI.h3 + " pt-4"}>Which checks did we run, and what did each one find?</h3>
          <p className={UI.body + " max-w-3xl"}>Each check comes from something you can read further down &mdash; a good result and a bad one both stay visible. Marked <span className="font-bold text-[#0b6b60]">Confirmed</span> (we hold the document), <span className="font-bold text-[#2b31d8]">Reported</span> (a source we cite), or <span className="font-bold text-[#4a4d56]">Our guess</span>.</p>
          {/* A ledger, not a card wall — the same label | stamp | answer rows the reputation matrix
              below uses, so the two evidence readouts on this page share one shape. */}
          <ul className="divide-y divide-[#111214]/10 overflow-hidden rounded-[14px] border border-[#111214]/15 bg-white">
            {composed.factors.map((f) => (
              <li key={f.label} className={`flex items-start gap-3 px-4 py-3 ${f.ok === false ? "bg-[#ffecea]" : ""}`}>
                <span className={`ink-1 mt-0.5 grid size-5 shrink-0 place-items-center rounded-md ${f.ok === true ? "bg-[#12b3a6] text-white" : f.ok === false ? "bg-[#ce403b] text-white" : "bg-[var(--background)] text-[#4a4d56]"}`} aria-hidden="true">
                  {f.ok === true ? <Check className="size-3" /> : f.ok === false ? <X className="size-3" /> : <CircleDashed className="size-3" />}
                </span>
                <div className="grid min-w-0 flex-1 gap-x-4 gap-y-0.5 sm:grid-cols-[200px_1fr]">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 self-start">
                    <p className="text-[13px] font-extrabold tracking-[-.01em] text-[#111214]">{signalLabel(f.label)}</p>
                    {f.confidence && <TierChip tier={f.confidence} />}
                  </div>
                  <p className="text-[13px] font-medium leading-5 text-[var(--muted)]">{f.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </NumberedSection>

        {/* ── Alerts: grouped, only when present ──────────────────────────────────────── */}
        {hasAlerts && (
          <NumberedSection id="alerts" number={number("alerts")} eyebrow="Read this first" title={`What is flagged on ${vendor.name} right now?`}
            intro={`Enough to change how you read the rest of this page: ${alertReasons}. Each one is a record we can show you, not our opinion — the detail and its source are below.`}>
            {statusAlert && <VendorStatusBanner status={statusAlert} vendorName={vendor.name} />}
            {vendorFlags.length > 0 && <VendorFlagsBanner flags={vendorFlags} vendorName={vendor.name} />}
            {enforcement.length > 0 && <EnforcementBanner actions={enforcement} vendorName={vendor.name} />}
          </NumberedSection>
        )}
      </Section>

      {/* ── Sticky jump-nav ─────────────────────────────────────────────────────────── */}
      <JumpNav items={sections} identity={{ name: vendor.name, letter: grade.letter }} />

      {/* ── Evidence ──────────────────────────────────────────────────────────────────
          Every section below renders whether or not we hold the evidence for it. A missing section
          reads as "nothing to see here"; the honest answer is "nobody has published this", and that
          gap is the single most useful thing this site can tell a buyer. Panels that bring their own
          container (the lab-test table, the legacy trackers, buyers and offers) sit in a wrapper that
          cancels this band's side padding, so their edges line up with the frames. */}
      <Section tight className="grid gap-4">
        <NumberedSection id="reputation" number={number("reputation")} eyebrow="Evidence, check by check" title="Where does the evidence hold up, and where is it missing?"
          intro={reputation
            ? <>Of the {reputation.dimensions.length} things we check on a vendor, {repEstablished} {repEstablished === 1 ? "is" : "are"} backed by evidence we can point at, {repDisputed} {repDisputed === 1 ? "needs" : "need"} a closer look, and {repUnknown} we simply don&rsquo;t know. Each row says which, and where it came from.</>
            : undefined}>
          {reputation ? (
            <>
              <VendorReputationTiles dimensions={reputation.dimensions} />
              <p className={UI.small + " max-w-3xl"}>Each answer stands on its own and says where it came from. Where we don&rsquo;t have the evidence, it says so &mdash; we never invent a number or blend everything into one score.</p>
            </>
          ) : (
            <NoEvidence
              answer={`We haven’t built a check-by-check reputation record for ${vendor.name} yet.`}
              note="That record is assembled from lab reports, shipping history, buyer reviews and fraud-case records. Until it exists, read the individual sections below on their own — an absent record is a gap in what we hold, not a finding about the vendor."
            />
          )}
        </NumberedSection>

        {vendorLabTests.length > 0 ? (
          <div id="lab-tests" className="-mx-5 scroll-mt-36 sm:-mx-8">
            <LabTestsPanel tests={vendorLabTests} heading={`Has anyone independently tested ${vendor.name}?`} />
          </div>
        ) : (
          <NumberedSection id="lab-tests" number={number("lab-tests")} eyebrow="Independent testing" title={`Has anyone independently tested ${vendor.name}?`}>
            <NoEvidence
              answer={`No independent lab certificate for ${vendor.name} is on record with us.`}
              note="We read certificates from the public feeds independent labs publish and from the certificates vendors post themselves. Neither has produced one for this vendor. That is not evidence against them — it means nobody has published a test we can read, so there is nothing here to check a claim against. Unknown is not the same as clean."
            />
          </NumberedSection>
        )}

        {noCommerce ? null : <>
        {aggregatorRatings.length > 0 ? (
          <div id="trackers" className="-mx-5 scroll-mt-36 sm:-mx-8">
            <AggregatorRatingsPanel ratings={aggregatorRatings} vendorName={vendor.name} />
          </div>
        ) : (
          <NumberedSection id="trackers" number={number("trackers")} eyebrow="Third-party aggregators" title={`What do other trackers say about ${vendor.name}?`}>
            <NoEvidence
              answer={`No independent peptide tracker we follow has published a rating for ${vendor.name}.`}
              note="We read the ratings other aggregators publish and show them side by side with a link to each source. None of them covers this vendor, so there is no second opinion to compare ours against."
            />
          </NumberedSection>
        )}

        {vendorSignals ? (
          <VendorSignalsPanel signals={vendorSignals} vendorName={vendor.name} number={number("signals")} />
        ) : (
          <NumberedSection id="signals" number={number("signals")} eyebrow="Operational signals" title={`What does ${vendor.name}’s own storefront tell us?`}>
            <NoEvidence
              answer={`We haven’t read ${vendor.name}’s own site into a record yet.`}
              note="This section normally carries neutral facts from the vendor's public site and domain records — how old the domain is, which payment rails it takes, whether it posts a research-use-only notice. None of it proves what is in a vial, and right now we hold none of it for this vendor."
            />
          </NumberedSection>
        )}

        </>}
        {noCommerce ? null : (
        <div id="reviews" className="grid scroll-mt-36 gap-4">
          {vendorReview ? (
            <div className="-mx-5 sm:-mx-8"><VendorReviewsPanel review={vendorReview} vendorName={vendor.name} /></div>
          ) : (
            <NumberedSection id="reviews-record" number={number("reviews")} eyebrow="What buyers say" title={`What do buyers report about ${vendor.name}?`}>
              <NoEvidence
                answer={`We haven’t gathered a buyer-review record for ${vendor.name}.`}
                note="We collect buyer reports from public web sources and weight them toward specific, reproducible failures over generic praise. Nothing has been gathered for this vendor yet — silence here is an absence of information, not an absence of problems."
              />
            </NumberedSection>
          )}
          {communitySignal ? (
            <div className="-mx-5 sm:-mx-8"><CommunitySignalCard signal={communitySignal} vendorName={vendor.name} /></div>
          ) : (
            <NumberedSection id="community-record" number={number("reviews")} eyebrow="Community" title={`What does r/Peptides say about ${vendor.name}?`}>
              <NoEvidence
                answer={`No r/Peptides discussion for ${vendor.name} has been captured.`}
                note="Real vendors usually get talked about. An absence of mentions is a mild signal worth noticing — it is not a clean bill of health, and it is not proof the vendor is new or fake either."
              />
            </NumberedSection>
          )}
        </div>
        )}

        {/* Regulators get their own section even when the answer is "nothing on file" — that is the
            answer most readers came for, and the jump-nav chip used to land on an empty div. When
            there IS a record, the full detail stays in the alert at the top rather than being
            repeated here, because the alarm belongs above the fold. */}
        <NumberedSection id="enforcement" number={number("enforcement")} eyebrow="Regulators" title={`Has any regulator taken action against ${vendor.name}?`}>
          {enforcement.length > 0 ? (
            <Notice tone="danger" icon={Gavel} title={<>Yes &mdash; {enforcement.length} public record{enforcement.length === 1 ? "" : "s"} name{enforcement.length === 1 ? "s" : ""} {vendor.name}, or an operator we matched to it.</>}>
              <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[#3a3d46]">Each agency, action type, outcome and a link to the original document {enforcement.length === 1 ? "is" : "are"} at the <a href="#alerts" className="font-extrabold text-[#2b31d8] underline underline-offset-2">top of this page</a>. We report the action and link the source; we do not add an accusation of our own.</p>
            </Notice>
          ) : (
            <NoEvidence
              answer={`No FDA, DOJ or FTC enforcement or recall record is on file for ${vendor.name}.`}
              note="We check public agency records for actions naming this vendor or an operator matched to it, and found none. An absent record is not a clean bill of health: most sellers in this market have never been the subject of a public action, and enforcement lags the market by years."
            />
          )}
        </NumberedSection>

        <VendorNewsPanel items={vendorNews} vendorName={vendor.name} vendorSlug={vendor.slug} number={number("news")} />
        {vendorOffers.length > 0 && !noCommerce && <div id="offers" className="-mx-5 scroll-mt-36 sm:-mx-8"><VendorOffersPanel offers={vendorOffers} vendorName={vendor.name} /></div>}
        <VendorLinksPanel links={vendorLinks} vendorName={vendor.name} number={number("network")} />

        {/* ── Catalog + history ───────────────────────────────────────────────────────── */}
        {catalogStale && !noCommerce && (
          <Notice tone="warn" icon={CircleDashed}>
            <p>
              <strong className="font-extrabold">These prices may be out of date.</strong> We last read this
              vendor&rsquo;s store {staleDays} days ago and haven&rsquo;t been able to since &mdash; some storefronts
              block automated checks. Treat the prices below as last-seen, not current, and confirm on their site.
            </p>
          </Notice>
        )}
        <section id="catalog" className={noCommerce ? "grid scroll-mt-36 gap-4" : "grid scroll-mt-36 gap-8 lg:grid-cols-[1fr_340px] lg:items-start"}>
          {noCommerce ? null : (
            <NumberedSection id="catalog-listings" number={number("catalog")} eyebrow="Catalog" title={`What does ${vendor.name} sell, and at what price?`}
              chips={listings.length > 0 && priceIndex.medianPctVsMarket != null ? <Chip tone={priceIndex.medianPctVsMarket < 0 ? "mint" : priceIndex.medianPctVsMarket > 0 ? "warn" : "paper"}>{priceIndex.medianPctVsMarket < 0 ? "typically below market" : priceIndex.medianPctVsMarket > 0 ? "typically above market" : "around market rate"}</Chip> : undefined}
              intro={listings.length > 0
                ? `${listings.length} listing${listings.length === 1 ? "" : "s"} we have read from their store, cheapest per milligram first${priceIndex.medianPctVsMarket != null ? `, priced ${Math.abs(priceIndex.medianPctVsMarket)}% ${priceIndex.medianPctVsMarket < 0 ? "below" : priceIndex.medianPctVsMarket > 0 ? "above" : "at"} the market median across ${priceIndex.comparedCount} comparable listing${priceIndex.comparedCount === 1 ? "" : "s"}` : ", with too few priced peers to compare against the market"}. A price is not evidence of quality either way.`
                : undefined}>
              {listings.length > 0 ? (
                <CatalogGrid products={catalogSorted} />
              ) : (
                <NoEvidence
                  answer="We haven’t captured a shoppable catalog for this vendor."
                  note={`We track ${vendor.name} from lab records and public sources, but haven’t read a live storefront catalog${maker ? " — it’s an upstream manufacturer, not a shop" : ""}. There are no prices here to compare against the market.`}
                />
              )}
            </NumberedSection>
          )}

          <aside id="history" className="scroll-mt-36">
            <VendorHistoryRail history={noCommerce ? vendor.history.filter((h) => h.type !== "catalog") : vendor.history} vendorName={vendor.name} number={number("history")} />
          </aside>
        </section>
      </Section>
    </div>
  );
}

// The state a section takes when we hold no evidence for it. It carries the plain answer first, so
// the section stays independently readable, then why the gap exists — never a claim about the
// vendor. A visible "we don't know" is the product; a silently dropped section is not.
function NoEvidence({ answer, note }: { answer: string; note: string }) {
  // A missing record is one honest line in the quiet inner panel, not a billboard — the dashed
  // glyph marks it as a gap, and it takes the height of a row, not a card.
  return (
    <Quiet>
      <p className="flex items-start gap-2.5 text-sm font-extrabold leading-5 text-[#111214]"><CircleDashed className="mt-0.5 size-4 shrink-0 text-[#111214]/35" aria-hidden="true" />{answer}</p>
      <p className={UI.small + " mt-1 max-w-2xl pl-[26px]"}>{note}</p>
    </Quiet>
  );
}

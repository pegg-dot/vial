import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { CATALOG_CACHE_TAG } from "@/server/catalog/repository";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock3, ExternalLink, PackageCheck, Star, Truck } from "lucide-react";
import { getCompoundBySlug, getProductBySlug, getProductsByCompoundSlug, getVendorBySlug } from "@/server/catalog/repository";
import { formatCurrency } from "@/lib/format";
import { displayProductName, displayProductTitle, displaySize } from "@/lib/product-title";
import { vendorClaimLabelShort } from "@/lib/vendor-copy";
import { JsonLd } from "@/components/json-ld";
import { EvidenceBadge } from "@/components/evidence-badge";
import { evidenceBadgeFor } from "@/lib/evidence-badge-derive";
import { DataOriginBadge } from "@/components/data-origin-badge";
import { EvidenceMatrix } from "@/components/evidence-matrix";
import { VialGradePill } from "@/components/vial-grade-card";
import { deriveEvidenceDimensions } from "@/server/verify/evidence-dimensions";
import { LabTestsPanel } from "@/components/lab-tests-panel";
import { PriceSparkline } from "@/components/price-sparkline";
import { ProductActions } from "@/components/product-actions";
import { DecisionRecorder } from "@/components/decision-recorder";
import { getCurrentPrincipal } from "@/server/auth/principal";
import { ProductPhoto } from "@/components/product-photo";
import { VendorMark } from "@/components/vendor-mark";
import { getPublicPassportForBatchCode } from "@/server/evidence-network/repository";
import { CoaCrossCheckPanel } from "@/components/coa-cross-check-panel";
import { BuyerReadCard } from "@/components/buyer-read";
import { buildBuyerRead } from "@/lib/buyer-read";
import { crossCheckCoa } from "@/server/verify/coa-cross-check";
import { getDatabase } from "@/server/db/client";
import { CompoundKnowledge } from "@/components/compound-knowledge";
import { educationFor } from "@/lib/compound-education";
import { depthFor } from "@/lib/compound-depth";
import { PriceFlag } from "@/components/listing-trust-chip";
import { UsLegalNotice } from "@/components/us-legal-notice";
import { getListingPriceMeta } from "@/server/ingest/price-history";
import { ProductMarketStats } from "@/components/market/product-market-stats";
import { listingMarketStats } from "@/lib/curation";
import { PriceLeaderboard } from "@/components/price-leaderboard";
import { getLabTestsForCompound } from "@/server/ingest/lab-tests";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  const vendor = await getVendorBySlug(product.vendorSlug);
  return {
    title: `${displayProductTitle(product.name, product.quantity)} from ${vendor?.name ?? "vendor"}`,
    description: `Compare the price, public documentation, batch linkage, and evidence limits for this ${product.origin === "live" ? "real" : "demo"} ${product.name} research listing.`,
    alternates: { canonical: `/products/${slug}` },
  };
}


// Public half: the vendor record and the batch passport. Same for everyone, cached under the
// shared "catalog" tag the collect cron invalidates. principal stays out — it reads a cookie.
const loadProductPublicData = unstable_cache(
  async (vendorSlug: string, batchCode: string) => {
    const [vendor, passport] = await Promise.all([getVendorBySlug(vendorSlug), getPublicPassportForBatchCode(batchCode)]);
    return { vendor, passport };
  },
  ["product-page"],
  { tags: [CATALOG_CACHE_TAG], revalidate: 21600 },
);

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const [publicData, principal] = await Promise.all([loadProductPublicData(product.vendorSlug, product.batchCode), getCurrentPrincipal()]);
  const { vendor, passport } = publicData;
  const compound = await getCompoundBySlug(product.compoundSlug);
  if (!vendor || !compound) notFound();

  const allForCompound = await getProductsByCompoundSlug(product.compoundSlug);
  const listingCount = allForCompound.length;
  // Market position runs on cost-per-mg, never sticker price — a 30mg vial isn't "expensive" next to
  // 2mg vials. If we can't read THIS listing's size, we can't place it, so stats is null (no verdict).
  const perMgPeers = allForCompound.map((p) => p.pricePerMg).filter((v): v is number => typeof v === "number" && v > 0);
  const marketStats = product.pricePerMg ? listingMarketStats(product.pricePerMg, perMgPeers) : null;
  const db = await getDatabase();
  const coaCheck = await crossCheckCoa(db, {
    vendorSlug: product.vendorSlug, vendorName: vendor.name,
    compoundSlug: product.compoundSlug, compoundName: compound.name,
    reportIssuer: product.reportIssuer, reportConfirmed: product.reportConfirmed, advertisesTesting: product.advertisesTesting, batchCode: product.batchCode,
  });
  const priceMeta = await getListingPriceMeta(db, product.slug);
  const compoundLabTests = await getLabTestsForCompound(db, product.compoundSlug);
  const education = educationFor(product.compoundSlug);
  const stackedBriefs = education?.stackedWith?.length
    ? (await db.query<{ slug: string; canonical_name: string }>(`SELECT slug, canonical_name FROM compounds WHERE slug = ANY($1)`, [education.stackedWith])).rows.map((r) => ({ slug: r.slug, name: r.canonical_name }))
    : [];
  const priceStart = product.priceHistory[0];
  const priceEnd = product.priceHistory.at(-1) ?? product.price;
  const priceChange = ((priceEnd - priceStart) / priceStart) * 100;

  // Structured data for a listing we AGGREGATE. Three constraints shape it:
  //
  //  - Demo listings emit nothing. A demo record is a seeded fictional product at a fictional
  //    price; publishing it as a Product with an Offer would push invented commerce into search
  //    results, no matter how carefully the description says "demo".
  //  - The seller is the vendor, and the offer URL is the VENDOR'S product page. It previously
  //    pointed at this page, which states that VialGrade sells the vial. VialGrade sells nothing
  //    and never touches payment — the offer belongs to whoever can actually fulfil it.
  //  - No aggregateRating unless the reviews behind it are real, which for this field means a
  //    Live record. A seeded demo rating is fabricated review data.
  const structuredData = product.origin === "live" ? {
    "@context": "https://schema.org",
    "@type": "Product",
    name: displayProductTitle(product.name, product.quantity),
    description: `Research listing from ${vendor.name}, aggregated from their public product page.`,
    brand: { "@type": "Brand", name: vendor.name },
    sku: product.batchCode,
    ...(product.reviewCount > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.rating, reviewCount: product.reviewCount } } : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: product.price,
      availability: product.availability === "In stock" ? "https://schema.org/InStock" : "https://schema.org/LimitedAvailability",
      seller: { "@type": "Organization", name: vendor.name },
      ...(product.externalUrl ? { url: product.externalUrl } : {}),
    },
  } : null;

  return (
    <>
      {principal && <DecisionRecorder eventType="listing_viewed" subjectType="listing" subjectId={product.slug} metadata={{ compoundSlug: product.compoundSlug, vendorSlug: product.vendorSlug }} />}
      {structuredData && <JsonLd data={structuredData} />}
      <section className="mx-auto max-w-[1320px] px-5 py-6 sm:px-8 sm:py-8">
        <Link href="/market" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--muted)] transition hover:text-black">
          <ArrowLeft className="size-4" /> Back to market
        </Link>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_.95fr] lg:gap-10">
          <div className="ink hard self-start overflow-hidden rounded-[20px] bg-white">
            <ProductPhoto name={product.name} quantity={product.quantity} accent={product.accent} imageUrl={product.imageUrl} />
          </div>

          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <EvidenceBadge {...evidenceBadgeFor(product)} />
              <DataOriginBadge origin={product.origin} />
              <span className="ink-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-black/60">{compound.category}</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link href={`/vendors/${vendor.slug}`} className="inline-flex w-fit items-center gap-1 text-sm font-bold text-[var(--muted)] hover:text-black">{vendor.name}</Link>
              {/* The seller's grade, right next to their name. A buyer deciding on THIS listing is
                  really deciding whether to trust THIS seller, and most arrive here from search or
                  /market without ever opening the vendor report. */}
              {vendor.grade && (
                <Link href={`/vendors/${vendor.slug}`} className="press">
                  <VialGradePill grade={vendor.grade} />
                </Link>
              )}
            </div>
            <h1 className="mt-1 text-[clamp(1.55rem,3.2vw,2.4rem)] font-extrabold leading-[1.02] tracking-[-.035em]">{displayProductName(product.name)} <span className="text-black/35">{displaySize(product.name, product.quantity)}</span></h1>
            <p className="mt-3 line-clamp-2 text-sm font-medium leading-6 text-[var(--muted)]">{compound.description}</p>

            {/* Buy box — price + market context + facts + action + vendor track record, grouped */}
            <div className="ink hard mt-5 rounded-[18px] bg-white p-5">
              <ProductMarketStats
                price={product.price}
                pricePerMg={product.pricePerMg}
                adjustedPricePerMg={product.trust?.adjustedPricePerMg ?? undefined}
                previousPrice={product.previousPrice}
                stats={marketStats}
              />
              <div className="mt-4 flex items-center gap-2">
                <PriceFlag trust={product.trust} />
                {product.reviewCount > 0
                  ? <span className="ml-auto inline-flex items-center gap-1.5 text-sm font-bold"><Star className="size-4 fill-current" /> {product.rating} <span className="font-medium text-[var(--muted)]">({product.reviewCount})</span></span>
                  : <span className="ml-auto text-xs font-semibold text-[var(--muted)]">No buyer reviews yet</span>}
              </div>

              <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t-2 border-[#111214]/[.08] pt-4 text-xs">
                <FactInline icon={PackageCheck} label="Availability" value={product.availability} />
                <FactInline icon={Clock3} label="Checked" value={product.lastChecked} />
                {product.shipping ? <FactInline icon={Truck} label="Shipping" value={product.shipping} /> : null}
                {product.reportDate ? <FactInline icon={CalendarDays} label="Report" value={product.reportDate} /> : null}
              </dl>

              <div className="mt-5">
                <ProductActions slug={product.slug} vendorName={vendor.name} origin={product.origin} externalUrl={product.externalUrl} />
              </div>

              <Link href={`/vendors/${vendor.slug}`} className="ink-1 press mt-4 flex items-center gap-3 rounded-[14px] bg-[var(--background)] p-3">
                <VendorMark initials={vendor.initials} accent={vendor.accent} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold">{vendor.name}</p>
                  <p className="text-[11px] font-semibold text-[var(--muted)]">{vendorClaimLabelShort(vendor.profileStatus)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-center">
                  <VendorTiny value={String(vendor.coaCount)} label="Lab tests" />
                  <VendorTiny value={vendor.medianPurity != null ? `${vendor.medianPurity.toFixed(1)}%` : "—"} label="Median purity" />
                  <VendorTiny value={String(vendor.productCount)} label="Listings" />
                </div>
                <ExternalLink className="size-4 shrink-0 text-black/30" />
              </Link>
            </div>

            <p className="mt-3 text-[11px] leading-4 text-[var(--muted)]">
              {product.origin === "live"
                // The research-use framing belongs HERE — at the moment someone leaves to buy —
                // not in a modal on arrival. A gate on an information site establishes nothing and
                // this is the point where it is actually relevant.
                ? "Real listing aggregated from the vendor's public page. Buying happens on their site, never on VialGrade — we take no payment and hold no stock. These are sold for laboratory research use only, not for human consumption; the seller sets their own terms and age limits at checkout."
                : "Demo listing shown to illustrate the interface — not a real vendor — so its link stays off. On real (Live) listings, buying happens on the vendor's own site, never on VialGrade."}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 pb-2 sm:px-8">
        <div className="max-w-3xl">
          <BuyerReadCard read={buildBuyerRead({
            status: coaCheck.status,
            independentPurity: coaCheck.independentPurity ?? null,
            priceFlag: product.trust?.priceFlag ?? null,
            priceAssessable: Boolean(product.pricePerMg) && perMgPeers.length >= 4,
            compoundCoas: product.trust?.compoundCoas ?? 0,
            compoundMedianPurity: product.trust?.compoundMedianPurity ?? null,
            vendorFlagged: product.trust?.vendorFlagged ?? false,
            compoundName: compound.name,
            vendorName: vendor.name,
          })} />
        </div>
      </section>

      {/* Who else sells this compound, and for how much — the buyer's real question, answered in-page */}
      <PriceLeaderboard compoundName={compound.name} listings={allForCompound} labTests={compoundLabTests} />

      {education ? (
        <section className="mx-auto max-w-[1320px] px-5 pb-2 pt-2 sm:px-8">
          <CompoundKnowledge name={compound.name} education={education} depth={depthFor(product.compoundSlug)} stacked={stackedBriefs} />
        </section>
      ) : null}

      <section className="mx-auto max-w-[1320px] px-5 py-8 sm:px-8 sm:py-10">
        <div className="mb-6">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#0e8f80]">The lab evidence</p>
          <h2 className="mt-3 text-[clamp(1.6rem,3vw,2.2rem)] font-extrabold leading-[1] tracking-[-.04em]">What we could verify</h2>
          <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[var(--muted)]">Each row answers a different question. Passing the identity test doesn&rsquo;t mean it&rsquo;s sterile or correctly dosed — we show each answer separately.</p>
        </div>
        <EvidenceMatrix evidence={product.evidence.length ? product.evidence : deriveEvidenceDimensions(coaCheck)} />

        {compoundLabTests.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-[12px] font-semibold leading-5 text-[var(--muted)]">These certificates are for <strong className="text-black/70">{compound.name}</strong> across <strong className="text-black/70">every maker VialGrade tracks</strong> — not necessarily {vendor.name}&rsquo;s own stock. This listing&rsquo;s specific evidence is the matrix above.</p>
            <LabTestsPanel tests={compoundLabTests} heading={`Independent lab tests on record for ${compound.name}`} />
          </div>
        )}

        <div className="mt-5 grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
          <CoaCrossCheckPanel check={coaCheck} />

          {product.priceHistory.length >= 2 ? (
          <div className="ink hard rounded-[18px] bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.1em] text-[var(--muted)]">Price trend</p>
                <p className={`mt-1 text-lg font-extrabold ${priceChange <= 0 ? "text-[#0e8f80]" : "text-[#d3372c]"}`}>{priceChange > 0 ? "+" : ""}{priceChange.toFixed(1)}%</p>
              </div>
              <p className="text-xs font-semibold text-[var(--muted)]">{formatCurrency(priceStart)} → {formatCurrency(priceEnd)}</p>
            </div>
            <div className="mt-5 h-28"><PriceSparkline values={product.priceHistory} accent={product.accent[0]} height={94} /></div>
            {priceMeta.days >= 2 && priceMeta.since ? <p className="mt-3 text-[11px] leading-4 text-black/45">{priceMeta.days} price checks since {new Date(priceMeta.since).toLocaleDateString()} — from live catalog fetches and archived catalog snapshots. Real observed prices, not a projection.</p> : null}
          </div>
          ) : null}

          {product.reportIssuer ? (
          <div className="ink hard rounded-[18px] bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#2b31d8]">Report record</p>
            <dl className="mt-5 space-y-4 text-sm">
              <Detail label="Lab" value={product.reportIssuer} />
              <Detail label="Report date" value={product.reportDate} />
              <Detail label="Batch" value={product.batchCode} />
              <Detail label="Who picked the sample" value={product.sampleOrigin} />
              <Detail label="Lab confirmed it’s theirs" value={product.reportConfirmed ? "Yes" : "No"} />
            </dl>
          </div>
          ) : null}

          {passport && <Link href={`/passports/${String(passport.slug)}`} className="ink hard press group block rounded-[18px] bg-[#f0edff] p-5">
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#5a4be0]">This batch has been tested</p>
            <p className="mt-3 text-lg font-extrabold">See the full lab record for this batch</p>
            <p className="mt-2 text-xs font-medium leading-5 text-[#111214]/60">What was tested, who tested it, and what came back. It describes the vials that were tested &mdash; not every vial in the batch.</p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#5a4be0]">Open the record <ExternalLink className="size-4 transition group-hover:translate-x-1"/></span>
          </Link>}

          <UsLegalNotice slug={product.compoundSlug} />
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 pb-14 sm:px-8">
        <Link href={`/compounds/${compound.slug}`} className="ink hard press group flex items-center justify-between gap-4 rounded-[18px] bg-white px-6 py-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#0e8f80]">Same compound</p>
            <p className="mt-1 text-lg font-extrabold tracking-[-.02em]">See the full {compound.name} market{listingCount > 1 ? ` — all ${listingCount} vendors` : ""}, price history & lab tests</p>
          </div>
          <span className="ink-1 hard-sm grid size-11 shrink-0 place-items-center rounded-full bg-[#eafff7] transition group-hover:translate-x-0.5"><ExternalLink className="size-5 text-[#0e8f80]" /></span>
        </Link>
      </section>
    </>
  );
}

function FactInline({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-3.5 text-[#12b3a6]" />
      <dt className="font-semibold text-[var(--muted)]">{label}</dt>
      <dd className="font-extrabold">{value}</dd>
    </div>
  );
}

function VendorTiny({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-sm font-extrabold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-[.06em] text-[var(--muted)]">{label}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-5 border-b border-[#111214]/[.08] pb-4 last:border-0 last:pb-0">
      <dt className="font-semibold text-[var(--muted)]">{label}</dt>
      <dd className="max-w-[58%] text-right font-bold">{value}</dd>
    </div>
  );
}


import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock3, ExternalLink, PackageCheck, Star, Truck } from "lucide-react";
import { getCompoundBySlug, getProductBySlug, getProductsByCompoundSlug, getVendorBySlug } from "@/server/catalog/repository";
import { formatCurrency, formatPricePerMg, vendorStatusLabel } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import { EvidenceBadge } from "@/components/evidence-badge";
import { DataOriginBadge } from "@/components/data-origin-badge";
import { EvidenceMatrix } from "@/components/evidence-matrix";
import { PriceSparkline } from "@/components/price-sparkline";
import { ProductActions } from "@/components/product-actions";
import { DecisionRecorder } from "@/components/decision-recorder";
import { getCurrentPrincipal } from "@/server/auth/principal";
import { ProductCard } from "@/components/product-card";
import { ProductVisual } from "@/components/product-visual";
import { VendorMark } from "@/components/vendor-mark";
import { getPublicPassportForBatchCode } from "@/server/evidence-network/repository";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  const vendor = await getVendorBySlug(product.vendorSlug);
  return {
    title: `${product.name} ${product.quantity} from ${vendor?.name ?? "vendor"}`,
    description: `Compare the price, public documentation, batch linkage, and evidence limits for this ${product.origin === "live" ? "real" : "demo"} ${product.name} research listing.`,
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const [vendor, principal, passport] = await Promise.all([getVendorBySlug(product.vendorSlug), getCurrentPrincipal(), getPublicPassportForBatchCode(product.batchCode)]);
  const compound = await getCompoundBySlug(product.compoundSlug);
  if (!vendor || !compound) notFound();

  const related = (await getProductsByCompoundSlug(product.compoundSlug)).filter((item) => item.slug !== product.slug).slice(0, 3);
  const priceStart = product.priceHistory[0];
  const priceEnd = product.priceHistory.at(-1) ?? product.price;
  const priceChange = ((priceEnd - priceStart) / priceStart) * 100;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${product.name} ${product.quantity}`,
    description: `${product.origin === "live" ? `Research listing from ${vendor.name}, aggregated from their public product page.` : `Demo research listing from ${vendor.name}, shown for interface demonstration only.`}`,
    brand: { "@type": "Brand", name: vendor.name },
    sku: product.batchCode,
    // Only advertise a rating when real reviews exist — never emit ratingValue 0 for a
    // real vendor (search engines render it as a 0-star product).
    ...(product.reviewCount > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.rating, reviewCount: product.reviewCount } } : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: product.price,
      availability: product.availability === "In stock" ? "https://schema.org/InStock" : "https://schema.org/LimitedAvailability",
      url: `${siteUrl}/products/${product.slug}`,
    },
  };

  return (
    <>
      {principal && <DecisionRecorder eventType="listing_viewed" subjectType="listing" subjectId={product.slug} metadata={{ compoundSlug: product.compoundSlug, vendorSlug: product.vendorSlug }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <section className="mx-auto max-w-[1320px] px-5 py-8 sm:px-8 sm:py-12">
        <Link href="/market" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] transition hover:text-black">
          <ArrowLeft className="size-4" /> Back to market
        </Link>

        <div className="grid gap-7 lg:grid-cols-[1.05fr_.95fr] xl:gap-12">
          <div className="self-start overflow-hidden rounded-[34px] border border-black/[.07] bg-white">
            <ProductVisual name={product.name} quantity={product.quantity} accent={product.accent} />
          </div>

          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <EvidenceBadge level={product.evidenceLevel} label={product.evidenceLabel} />
              <DataOriginBadge origin={product.origin} />
              <span className="rounded-full bg-black/[.045] px-2.5 py-1 text-[11px] font-semibold text-black/55">{compound.category}</span>
            </div>
            <p className="mt-6 text-sm font-semibold text-[var(--muted)]">{vendor.name}</p>
            <h1 className="mt-2 text-5xl font-semibold leading-[.92] tracking-[-.065em] sm:text-6xl">{product.name} <span className="text-black/28">{product.quantity}</span></h1>
            <p className="mt-5 text-base leading-7 text-[var(--muted)]">{compound.description}</p>

            <div className="mt-8 flex items-end justify-between gap-4 border-y border-black/[.07] py-6">
              <div>
                <p className="text-xs font-medium text-[var(--muted)]">Observed price</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <p className="text-4xl font-semibold tracking-[-.055em]">{formatCurrency(product.price)}</p>
                  {product.pricePerMg ? <span className="rounded-full bg-black/[.05] px-2.5 py-1 text-xs font-semibold tabular-nums text-black/70">{formatPricePerMg(product.pricePerMg)}</span> : null}
                  {product.previousPrice && product.previousPrice !== product.price ? <span className="text-sm text-[var(--muted)] line-through">{formatCurrency(product.previousPrice)}</span> : null}
                </div>
              </div>
              {product.reviewCount > 0
                ? <div className="flex items-center gap-1.5 text-sm font-semibold"><Star className="size-4 fill-current" /> {product.rating} <span className="font-normal text-[var(--muted)]">({product.reviewCount})</span></div>
                : <span className="text-xs text-[var(--muted)]">No buyer reviews yet</span>}
            </div>

            <div className="grid grid-cols-2 gap-3 py-6 sm:grid-cols-4">
              <Fact icon={PackageCheck} label="Availability" value={product.availability} />
              <Fact icon={Truck} label="Shipping" value={product.shipping} />
              <Fact icon={Clock3} label="Checked" value={product.lastChecked} />
              <Fact icon={CalendarDays} label="Report" value={product.reportDate || "None yet"} />
            </div>

            <ProductActions slug={product.slug} vendorName={vendor.name} origin={product.origin} externalUrl={product.externalUrl} />
            <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
              {product.origin === "live"
                ? "This is a real listing aggregated from the vendor's public page. Buying happens on their site, never on VIAL — and outbound links stay off until the affiliate step is approved."
                : "Buying happens on the vendor's own site, never on VIAL. In this prototype the data is fictional, so vendor links stay switched off."}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8 sm:py-16">
        <div className="grid gap-7 lg:grid-cols-[1.25fr_.75fr]">
          <div>
            <div className="mb-6">
              <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">The lab evidence</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-.045em]">What we could verify</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Each row answers a different question. Passing the identity test doesn&rsquo;t mean it&rsquo;s sterile or correctly dosed — we show each answer separately.</p>
            </div>
            <EvidenceMatrix evidence={product.evidence} />
          </div>

          <aside className="space-y-5">
            {product.priceHistory.length >= 2 ? (
            <div className="rounded-[26px] border border-black/[.07] bg-white p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-[var(--muted)]">Price trend</p>
                  <p className={`mt-1 text-lg font-semibold ${priceChange <= 0 ? "text-emerald-700" : "text-rose-600"}`}>{priceChange > 0 ? "+" : ""}{priceChange.toFixed(1)}%</p>
                </div>
                <p className="text-xs text-[var(--muted)]">{formatCurrency(priceStart)} → {formatCurrency(priceEnd)}</p>
              </div>
              <div className="mt-5 h-28"><PriceSparkline values={product.priceHistory} accent={product.accent[0]} height={94} /></div>
            </div>
            ) : null}

            {product.reportIssuer ? (
            <div className="rounded-[26px] border border-black/[.07] bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[var(--muted)]">Report record</p>
              <dl className="mt-5 space-y-4 text-sm">
                <Detail label="Issuer" value={product.reportIssuer} />
                <Detail label="Report date" value={product.reportDate} />
                <Detail label="Batch" value={product.batchCode} />
                <Detail label="Sample origin" value={product.sampleOrigin} />
                <Detail label="Issuer confirmed" value={product.reportConfirmed ? "Yes" : "No"} />
              </dl>
            </div>
            ) : null}

            {passport && <Link href={`/passports/${String(passport.slug)}`} className="group block rounded-[26px] border border-violet-200 bg-violet-50 p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
              <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-violet-700">This batch has been tested</p>
              <p className="mt-3 text-lg font-semibold">See the full lab record for this batch</p>
              <p className="mt-2 text-xs leading-5 text-violet-950/60">Sampling level {String(passport.sampling_level)} · {Math.round(Number(passport.evidence_confidence) * 100)}% evidence confidence. This describes the tested samples — not every vial in the batch.</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-violet-800">Open passport <ExternalLink className="size-4 transition group-hover:translate-x-1"/></span>
            </Link>}

            <Link href={`/vendors/${vendor.slug}`} className="group block rounded-[26px] border border-black/[.07] bg-white p-5 transition hover:border-black/[.14] hover:shadow-[0_16px_50px_rgba(20,22,27,.07)]">
              <div className="flex items-center gap-4">
                <VendorMark initials={vendor.initials} accent={vendor.accent} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{vendor.name}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{vendorStatusLabel(vendor.profileStatus)}</p>
                </div>
                <ExternalLink className="size-4 text-black/30 transition group-hover:text-black" />
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <MiniStat value={`${vendor.documentationCurrent}%`} label="Tests current" />
                <MiniStat value={String(vendor.history.length)} label="Observed events" />
                <MiniStat value={String(vendor.productCount)} label="Listings" />
              </div>
            </Link>
          </aside>
        </div>
      </section>

      {related.length > 0 && (
        <section className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8 sm:py-16">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Same compound</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-.045em]">Other {product.name} listings</h2>
            </div>
            <Link href={`/compounds/${compound.slug}`} className="text-sm font-semibold">View compound page</Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{related.map((item) => <ProductCard key={item.slug} product={item} />)}</div>
        </section>
      )}
    </>
  );
}

function Fact({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/[.035] p-3.5">
      <Icon className="size-4 text-black/35" />
      <p className="mt-3 text-[10px] text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-xs font-semibold leading-5">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-5 border-b border-black/[.055] pb-4 last:border-0 last:pb-0">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="max-w-[58%] text-right font-semibold">{value}</dd>
    </div>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-black/[.035] px-2 py-3">
      <p className="text-sm font-semibold">{value}</p>
      <p className="mt-0.5 text-[10px] text-[var(--muted)]">{label}</p>
    </div>
  );
}

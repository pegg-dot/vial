import { getCatalogSnapshot } from "@/server/catalog/repository";
import { formatCurrency, vendorStatusLabel } from "@/lib/format";
import { ProductCard } from "@/components/product-card";
import { SearchTrigger } from "@/components/search-trigger";
import { SectionHeading } from "@/components/section-heading";
import { VendorMark } from "@/components/vendor-mark";
import { ArrowRight, ChartNoAxesCombined, Check, CircleDashed, Database, Eye, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { compounds, products, vendors } = await getCatalogSnapshot();
  const featured = products.filter((product) => product.featured).slice(0, 4);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "VIAL",
    url: "https://vial.example",
    description: "An evidence-first peptide market intelligence prototype.",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://vial.example/market?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />

      <section className="relative isolate overflow-hidden border-b border-black/[.06]">
        <div className="hero-grid pointer-events-none absolute inset-0 -z-10 opacity-70" />
        <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(109,93,252,.16),rgba(183,119,255,.06)_42%,transparent_72%)] blur-2xl" />

        <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-20 sm:px-8 sm:pb-24 sm:pt-28 lg:pb-28 lg:pt-32">
          <div className="mx-auto max-w-5xl text-center">
            <div className="fade-up mx-auto inline-flex items-center gap-2 rounded-full border border-black/[.07] bg-white/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-black/55 shadow-sm backdrop-blur">
              <Sparkles className="size-3.5 text-[var(--accent)]" /> Evidence-first market intelligence
            </div>
            <h1 className="fade-up fade-up-delay-1 mt-7 text-balance text-[clamp(3.4rem,8.4vw,7.3rem)] font-semibold leading-[.88] tracking-[-.075em]">
              The peptide market,
              <span className="block text-gradient">made legible.</span>
            </h1>
            <p className="fade-up fade-up-delay-2 mx-auto mt-7 max-w-2xl text-balance text-base leading-7 text-[var(--muted)] sm:text-lg">
              One polished market for normalized listings, vendor history, pricing, public documentation, and clear evidence limits. No more fifteen tabs and anonymous forum threads.
            </p>
            <div className="fade-up fade-up-delay-3 mx-auto mt-9 max-w-2xl">
              <SearchTrigger />
            </div>
            <div className="fade-up fade-up-delay-3 mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-emerald-600" /> Standardized comparison</span>
              <span className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-emerald-600" /> Source-level provenance</span>
              <span className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-emerald-600" /> No black-box safety score</span>
            </div>
          </div>

          <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:mt-20 lg:grid-cols-4">
            <Metric label="Normalized listings" value={String(products.length)} detail="Across the prototype catalog" icon={Database} />
            <Metric label="Vendors observed" value={String(vendors.length)} detail="Claimed and independent profiles" icon={Eye} />
            <Metric label="Median listing" value={formatCurrency(products.reduce((sum, product) => sum + product.price, 0) / products.length)} detail="Across active demo offers" icon={ChartNoAxesCombined} />
            <Metric label="Current evidence" value={`${Math.round((products.filter((product) => !["stale", "public-only"].includes(product.evidenceLevel)).length / products.length) * 100)}%`} detail="Report located within policy window" icon={ShieldCheck} />
          </div>
        </div>
      </section>

      <div className="overflow-hidden border-b border-black/[.06] bg-white/50 py-3">
        <div className="market-ticker flex items-center gap-3 pr-3 text-xs font-semibold text-black/55">
          {[...compounds, ...compounds].map((compound, index) => (
            <div key={`${compound.slug}-${index}`} className="flex items-center gap-3 rounded-full border border-black/[.06] bg-white px-3 py-2 shadow-sm">
              <span className="size-2 rounded-full" style={{ background: compound.accent[0] }} />
              <span>{compound.name}</span>
              <span className="font-mono text-black/60">{formatCurrency(compound.medianPrice)}</span>
              <span className={compound.priceChange < 0 ? "text-emerald-700" : "text-rose-600"}>{compound.priceChange > 0 ? "+" : ""}{compound.priceChange}%</span>
            </div>
          ))}
        </div>
      </div>

      <section className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 sm:py-28">
        <SectionHeading
          eyebrow="Market signal"
          title="Listings worth a closer look"
          description="Featured records combine fresher documentation, stronger provenance, or meaningful price movement. Every card still exposes what remains unknown."
          href="/market"
          linkLabel="View full market"
        />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {featured.map((product) => <ProductCard key={product.slug} product={product} />)}
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 pb-20 sm:px-8 sm:pb-28">
        <div className="glass-dark relative overflow-hidden rounded-[36px] px-6 py-10 text-white sm:px-10 sm:py-14 lg:px-14 lg:py-16">
          <div className="pointer-events-none absolute -right-20 -top-44 size-[460px] rounded-full bg-[radial-gradient(circle,#7c65ff_0%,rgba(124,101,255,.18)_45%,transparent_70%)] blur-xl" />
          <div className="pointer-events-none absolute -bottom-48 left-[28%] size-[480px] rounded-full bg-[radial-gradient(circle,#50d9bc_0%,rgba(80,217,188,.13)_44%,transparent_70%)] blur-xl" />
          <div className="relative grid gap-12 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-white/45">The hidden product</p>
              <h2 className="mt-4 max-w-xl text-4xl font-semibold leading-[.98] tracking-[-.055em] sm:text-5xl">Evidence over vibes.</h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/58">
                The storefront stays simple. Underneath, every visible claim points to a source, a timestamp, a named entity, and an explicit confidence state.
              </p>
              <Link href="/methodology" className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90">
                Explore methodology <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="grid gap-3">
              <DarkEvidence icon={Database} title="Source snapshots" detail="Immutable records preserve what a vendor, lab, or official source showed at a specific time." />
              <DarkEvidence icon={CircleDashed} title="Unknown stays visible" detail="Missing sterility, quantity, or batch evidence is shown as unknown, not silently converted into trust." />
              <DarkEvidence icon={ShieldCheck} title="Human publication gates" detail="Agents extract and compare. High-impact claims, legal states, and accusations require review." />
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-black/[.06] bg-white/60">
        <div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 sm:py-24">
          <SectionHeading
            eyebrow="Vendor graph"
            title="Persistent profiles, not disposable domains"
            description="Each profile separates seller participation from the independent record VIAL has assembled over time."
            href="/market"
            linkLabel="Browse listings"
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {vendors.map((vendor) => (
              <Link key={vendor.slug} href={`/vendors/${vendor.slug}`} className="group rounded-[26px] border border-black/[.07] bg-white p-5 transition hover:-translate-y-0.5 hover:border-black/[.14] hover:shadow-[0_18px_50px_rgba(20,22,27,.08)]">
                <div className="flex items-start gap-4">
                  <VendorMark initials={vendor.initials} accent={vendor.accent} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold tracking-[-0.02em]">{vendor.name}</h3>
                        <p className="mt-1 text-xs text-[var(--muted)]">{vendorStatusLabel(vendor.profileStatus)}</p>
                      </div>
                      <ArrowRight className="size-4 text-black/25 transition group-hover:translate-x-0.5 group-hover:text-black" />
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                      <MiniMetric value={`${vendor.documentationCurrent}%`} label="Current docs" />
                      <MiniMetric value={String(vendor.productCount)} label="Products" />
                      <MiniMetric value={String(vendor.history.length)} label="Observed events" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 sm:py-28">
        <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">How it works</p>
            <h2 className="mt-3 text-4xl font-semibold leading-[1] tracking-[-.055em] sm:text-5xl">Simple outside. Rigorous underneath.</h2>
            <p className="mt-5 max-w-md text-base leading-7 text-[var(--muted)]">
              VIAL is designed like a premium marketplace, but the internal object model behaves more like a financial data terminal.
            </p>
          </div>
          <div className="grid gap-3">
            <Step number="01" title="Normalize the market" detail="Vendor names, quantities, forms, batches, prices, and shipping claims become comparable records." />
            <Step number="02" title="Attach evidence" detail="Every report, confirmation, snapshot, and regulatory event is linked to the exact entity it supports." />
            <Step number="03" title="Track change" detail="Price, availability, documents, policies, and seller identities develop a persistent history." />
            <Step number="04" title="Gate transactions" detail="The interface can support checkout later, but only where seller, processor, catalog, and policy eligibility align." />
          </div>
        </div>
      </section>
    </>
  );
}

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-[24px] border border-black/[.07] bg-white/78 p-5 shadow-[0_1px_2px_rgba(0,0,0,.02)] backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
        <Icon className="size-4 text-black/35" />
      </div>
      <p className="mt-5 text-3xl font-semibold tracking-[-0.055em]">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{detail}</p>
    </div>
  );
}

function DarkEvidence({ icon: Icon, title, detail }: { icon: React.ComponentType<{ className?: string }>; title: string; detail: string }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[.055] p-5 backdrop-blur">
      <div className="flex items-start gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10"><Icon className="size-4" /></span>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1.5 text-sm leading-6 text-white/50">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-black/[.035] px-2 py-3">
      <p className="text-sm font-semibold">{value}</p>
      <p className="mt-0.5 text-[10px] text-[var(--muted)]">{label}</p>
    </div>
  );
}

function Step({ number, title, detail }: { number: string; title: string; detail: string }) {
  return (
    <div className="grid gap-4 rounded-[26px] border border-black/[.07] bg-white p-5 sm:grid-cols-[54px_1fr] sm:p-6">
      <span className="grid size-12 place-items-center rounded-2xl bg-black text-xs font-semibold text-white">{number}</span>
      <div>
        <h3 className="text-lg font-semibold tracking-[-0.025em]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{detail}</p>
      </div>
    </div>
  );
}

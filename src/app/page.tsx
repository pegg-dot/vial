import { getCatalogSnapshot } from "@/server/catalog/repository";
import { formatCurrency } from "@/lib/format";
import { ProductCard } from "@/components/product-card";
import { SearchTrigger } from "@/components/search-trigger";
import { SectionHeading } from "@/components/section-heading";
import { HomeGoalRail } from "@/components/home-goal-rail";
import { HomeVendorCarousel } from "@/components/home-vendor-carousel";
import { GumdropScene } from "@/components/gumdrop-scene";
import { ArrowRight, ChartNoAxesCombined, Check, CircleDashed, Database, Eye, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { compounds, products, vendors } = await getCatalogSnapshot();
  const featured = products.filter((product) => product.featured).slice(0, 4);
  // Curated carousel: the most independently-tested vendors first, then the biggest catalogs — a
  // meaningful shortlist instead of the full 83-wide wall.
  const topVendors = [...vendors]
    .sort((a, b) => b.coaCount - a.coaCount || b.productCount - a.productCount || b.passportCount - a.passportCount)
    .slice(0, 14);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "VIAL",
    url: "https://vial.example",
    description: "Every peptide vendor's price, lab test, and reputation on one screen.",
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
        <div className="hero-grid pointer-events-none absolute inset-0 -z-10 opacity-60" />
        <GumdropScene variant="hero" />

        <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-20 sm:px-8 sm:pb-24 sm:pt-28 lg:pb-28 lg:pt-32">
          <div className="mx-auto max-w-5xl text-center">
            <div className="fade-up mx-auto inline-flex items-center gap-2 rounded-full border border-black/[.07] bg-white/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-black/55 shadow-sm backdrop-blur">
              <Sparkles className="size-3.5 text-[var(--accent)]" /> The peptide market, on one screen
            </div>
            <h1 className="fade-up fade-up-delay-1 mt-7 text-balance text-[clamp(3.4rem,8.4vw,7.3rem)] font-semibold leading-[.88] tracking-[-.075em]">
              Don&rsquo;t get scammed
              <span className="block text-gradient">buying peptides.</span>
            </h1>
            <p className="fade-up fade-up-delay-2 mx-auto mt-7 max-w-2xl text-balance text-base leading-7 text-[var(--muted)] sm:text-lg">
              Every vendor&rsquo;s price, lab test, and reputation on one screen &mdash; the research you&rsquo;d normally do across fifteen tabs and anonymous forum threads, done for you. Free, and we don&rsquo;t sell anything.
            </p>
            <div className="fade-up fade-up-delay-3 mx-auto mt-9 max-w-2xl">
              <SearchTrigger />
            </div>
            <div className="fade-up fade-up-delay-3 mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-emerald-600" /> Prices compared across vendors</span>
              <span className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-emerald-600" /> Lab tests matched to batches</span>
              <span className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-emerald-600" /> No black-box safety score</span>
            </div>
          </div>

          <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:mt-20 lg:grid-cols-4">
            <Metric label="Listings tracked" value={String(products.length)} detail="Demo + live listings" icon={Database} />
            <Metric label="Vendors tracked" value={String(vendors.length)} detail="Demo and live vendors" icon={Eye} />
            <Metric label="Average price" value={formatCurrency(products.reduce((sum, product) => sum + product.price, 0) / products.length)} detail="Across active listings" icon={ChartNoAxesCombined} />
            <Metric label="Independent lab tests" value={String(compounds.reduce((sum, compound) => sum + compound.coaCount, 0))} detail="Real COAs read on record" icon={ShieldCheck} />
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
          eyebrow="Worth a look"
          title="Listings worth a closer look"
          description="Fresher lab tests, stronger proof, or a real price move. Every card still shows what's missing."
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
              <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-white/45">Under the hood</p>
              <h2 className="mt-4 max-w-xl text-4xl font-semibold leading-[.98] tracking-[-.055em] sm:text-5xl">Evidence over vibes.</h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/58">
                The surface stays simple. Underneath, every claim points to a source, a timestamp, and a named lab or vendor &mdash; with how sure we are spelled out.
              </p>
              <Link href="/how-we-check" className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90">
                See how we check <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="grid gap-3">
              <DarkEvidence icon={Database} title="We keep the receipts" detail="A saved, timestamped copy of what every vendor and lab actually showed." />
              <DarkEvidence icon={CircleDashed} title="Unknown stays visible" detail="Missing sterility, dose, or batch evidence shows as unknown &mdash; never quietly rounded up to trust." />
              <DarkEvidence icon={ShieldCheck} title="A human checks the big claims" detail="Software gathers and compares. Scam flags, legal notes, and accusations wait for a person to review." />
            </div>
          </div>
        </div>
      </section>

      {/* Browse-by-goal + curated vendor carousel — gumdrop-scientific, no more 83-wide wall. */}
      <section className="relative isolate overflow-hidden border-y border-black/[.06] bg-white/60">
        {/* soft floating gumdrops in the background */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="gum-blob gum-float absolute -left-16 top-16 size-56 bg-[radial-gradient(circle,rgba(143,255,214,.5),transparent_70%)] blur-2xl" />
          <div className="gum-blob-2 gum-float-rev absolute right-[-4rem] top-40 size-64 bg-[radial-gradient(circle,rgba(109,93,252,.28),transparent_70%)] blur-2xl" />
          <div className="gum-blob gum-float-slow absolute bottom-8 left-1/3 size-52 bg-[radial-gradient(circle,rgba(96,165,250,.30),transparent_70%)] blur-2xl" />
        </div>
        <div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 sm:py-24">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-blue-700">Start with a goal</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-.05em] sm:text-5xl">What are you researching?</h2>
            <p className="mt-4 text-base leading-7 text-[var(--muted)]">Pick a research area and we&rsquo;ll show the compounds &mdash; every vendor, price, and lab test lined up. No idea where to start? That&rsquo;s the point.</p>
          </div>
          <div className="mt-8">
            <HomeGoalRail />
          </div>

          <div className="mt-16 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-blue-700">Vendor track records</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-[-.05em] sm:text-5xl">Most-tested vendors</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">A shady seller can spin up a new site overnight &mdash; but they can&rsquo;t fake an independent lab record. Here are the ones with the most tests on file.</p>
            </div>
            <Link href="/vendors" className="inline-flex items-center gap-1.5 rounded-full border border-black/[.1] bg-white px-4 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 hover:border-black/25 hover:shadow-[0_10px_26px_rgba(20,22,27,.1)]">
              Browse all {vendors.length} <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mt-8">
            <HomeVendorCarousel vendors={topVendors} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 sm:py-28">
        <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">How it works</p>
            <h2 className="mt-3 text-4xl font-semibold leading-[1] tracking-[-.055em] sm:text-5xl">Simple to use. Serious underneath.</h2>
            <p className="mt-5 max-w-md text-base leading-7 text-[var(--muted)]">
              You get a clean, side-by-side view. Behind it, every price and lab result is tracked, dated, and traceable back to where it came from.
            </p>
          </div>
          <div className="grid gap-3">
            <Step number="01" title="Every vendor, one format" detail="Prices, sizes, and claims lined up so you can actually compare them." />
            <Step number="02" title="Lab tests, matched to the batch" detail="We find the third-party test for the exact batch being sold &mdash; or show you there isn't one." />
            <Step number="03" title="Watch it change" detail="Prices, stock, and test coverage tracked over time, so you can spot a vendor slipping." />
            <Step number="04" title="Buy direct from the vendor" detail="When you've decided, we send you to the vendor's own site. VIAL never touches your money or the product." />
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

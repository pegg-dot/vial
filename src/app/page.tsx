import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCatalogSnapshot } from "@/server/catalog/repository";
import { HomeTicker } from "@/components/home/ticker";
import { HomeHero } from "@/components/home/hero";
import { HomeManifesto } from "@/components/home/manifesto";
import { HomeFeatures } from "@/components/home/features";
import { HomeGoalRail } from "@/components/home-goal-rail";
import { HomeVendorCarousel } from "@/components/home-vendor-carousel";
import { HomeBigNumber } from "@/components/home/big-number";
import { HomeCompoundsShowcase } from "@/components/home/compounds-showcase";
import { HomeFinalCta } from "@/components/home/final-cta";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { compounds, products, vendors } = await getCatalogSnapshot();
  const labTests = compounds.reduce((sum, c) => sum + c.coaCount, 0);
  // Curated shortlists — no more 83-wide walls.
  const topVendors = [...vendors]
    .sort((a, b) => b.coaCount - a.coaCount || b.productCount - a.productCount || b.passportCount - a.passportCount)
    .slice(0, 14);
  const topCompounds = [...compounds]
    .sort((a, b) => b.listings - a.listings || b.coaCount - a.coaCount)
    .slice(0, 6);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "VIAL",
    url: "https://vial.example",
    description: "Know what's really in the vial. Every peptide vendor's lab tests, prices, and reputation, fact-checked in one place.",
    potentialAction: { "@type": "SearchAction", target: "https://vial.example/market?q={search_term_string}", "query-input": "required name=search_term_string" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />

      <HomeTicker />
      <HomeHero />
      <HomeManifesto />
      <HomeFeatures />

      {/* Browse by goal */}
      <section className="border-b-2 border-[#111214] bg-white">
        <div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 sm:py-24">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Start with a goal</p>
            <h2 className="mt-4 text-balance text-[clamp(2.4rem,5.5vw,4rem)] font-extrabold leading-[.92] tracking-[-.045em]">What are you researching?</h2>
            <p className="mt-4 max-w-xl text-lg font-medium leading-8 text-[var(--muted)]">Pick a research area &mdash; we&rsquo;ll line up the compounds with every vendor, price, and lab test. No idea where to start? That&rsquo;s exactly the point.</p>
          </div>
          <div className="mt-9"><HomeGoalRail /></div>
        </div>
      </section>

      <HomeBigNumber labTests={labTests} vendors={vendors.length} listings={products.length} />

      {/* Most-tested vendors */}
      <section className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Vendor track records</p>
            <h2 className="mt-4 text-balance text-[clamp(2.4rem,5.5vw,4rem)] font-extrabold leading-[.92] tracking-[-.045em]">A new site can&rsquo;t fake an old lab record.</h2>
            <p className="mt-4 max-w-xl text-lg font-medium leading-8 text-[var(--muted)]">Scammers rebrand overnight. They can&rsquo;t rewrite a year of independent tests. Here are the vendors with the most on file.</p>
          </div>
          <Link href="/vendors" className="ink hard-sm press inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-3 text-sm font-bold text-[#111214]">
            Browse all {vendors.length} <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="mt-10"><HomeVendorCarousel vendors={topVendors} /></div>
      </section>

      <HomeCompoundsShowcase compounds={topCompounds} />
      <HomeFinalCta />
    </>
  );
}

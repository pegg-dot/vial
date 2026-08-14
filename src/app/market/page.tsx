import type { Metadata } from "next";
import { MarketExperience } from "@/components/market/market-experience";
import { VialValueBand } from "@/components/market/vial-value-band";
import { ArtTag, VialBuddy, ArtDroplet } from "@/components/vial-art";

export const metadata: Metadata = {
  alternates: { canonical: "/market" },
  title: "Market",
  description: "Browse and compare normalized peptide research listings with evidence and source context.",
};

// Market signature = bone base + a mint "live" pulse (the market moves), price-tag stickers.
export default function MarketPage() {
  return (
    <>
      <section className="relative isolate overflow-hidden border-b-2 border-[#111214] bg-[#eafff7]">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <ArtTag className="gum-float absolute right-[6%] top-[20%] hidden w-24 drop-shadow-[5px_5px_0_#111214] sm:block lg:w-28" fill="#12b3a6" />
          <VialBuddy className="gum-float-slow absolute right-[16%] bottom-[12%] hidden w-16 drop-shadow-[4px_4px_0_#111214] lg:block" liquid="#12b3a6" cap="#0e8f80" />
          <ArtDroplet className="gum-float-rev absolute right-[26%] top-[26%] hidden w-11 drop-shadow-[3px_3px_0_#111214] lg:block" fill="#12b3a6" />
        </div>
        <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.2em] text-[#0e8f80]"><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-[#12b3a6] opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-[#12b3a6]" /></span> The market</p>
            <h1 className="mt-4 text-balance text-[clamp(2.8rem,7vw,5.5rem)] font-extrabold leading-[.9] tracking-[-.05em]">The market, <span className="text-[#0e8f80]">on one screen.</span></h1>
            <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-[#111214]/70">Every listing from every vendor, side by side &mdash; price, lab test, batch, and availability. Aggregated from real public sources.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 pt-12 sm:px-8">
        <VialValueBand />
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8 sm:py-12">
        <MarketExperience />
      </section>
    </>
  );
}

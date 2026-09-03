import type { Metadata } from "next";
import { FileCheck2, Factory, Store } from "lucide-react";
import { ArtShieldCheck, ArtCoa } from "@/components/vial-art";
import { getVendorDirectory } from "@/server/vendors/directory";
import { getCertificatesOnRecord } from "@/server/public-repository";
import { VendorsDirectory } from "@/components/vendors-directory";
import { DataUnavailable } from "@/components/home-data-unavailable";
import { reportError } from "@/server/observability/alerts";

export const metadata: Metadata = { title: "Vendor directory", description: "Rank peptide vendors by what matters to you — reliability, price, purity, testing, or reputation — from real evidence.", alternates: { canonical: "/vendors" } };
export const dynamic = "force-dynamic";

// Vendors signature = light violet — the "records" tint, same warm-paper register as every other
// hero (market = mint). Steel stays an accent, never a page background: the old dark slate hero
// read as a different site bolted onto this one.
export default async function VendorsPage() {
  // Guard BEFORE deriving anything — the counts below read `entries` directly.
  const entries = await getVendorDirectory().catch((error) => { reportError({ kind: "vendors-unavailable", message: "The vendor directory could not be read.", context: { error: String(error) } }); return null; });
  const totalCoa = await getCertificatesOnRecord().catch(() => null);   // site-wide corpus, not the vendor-matched subset
  if (!entries || totalCoa === null) return <DataUnavailable surface="the vendor directory" />;
  const storefronts = entries.filter((e) => e.vendor.kind !== "manufacturer").length;
  const manufacturers = entries.filter((e) => e.vendor.kind === "manufacturer").length;

  return <>
    <section className="relative isolate overflow-hidden border-b-2 border-[#111214] bg-[#f0edff]">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <ArtCoa className="gum-float-slow absolute right-[6%] top-[16%] hidden w-20 drop-shadow-[5px_5px_0_#111214] sm:block lg:w-24" />
        <ArtShieldCheck className="gum-float absolute right-[16%] top-[48%] hidden w-16 drop-shadow-[4px_4px_0_#111214] lg:block" />
      </div>
      <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8 sm:py-12">
        <div className="max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#5a4be0]">Vendor directory</p>
          <h1 className="mt-3 text-balance text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[.95] tracking-[-.045em]">Rank every vendor by <span className="text-[#5a4be0]">what you care about.</span></h1>
          <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-[#111214]/70">Most reliable, cheapest, purest, most-tested, best-reviewed &mdash; sorted from lab records and public evidence, not marketing. A shady seller can rebrand overnight; the record follows them.</p>
        </div>
        <div className="ink hard-sm mt-8 grid max-w-2xl grid-cols-3 divide-x-2 divide-[#111214] overflow-hidden rounded-[16px] bg-white">
          <HeroStat icon={Store} value={String(storefronts)} label="Storefronts you can shop" />
          <HeroStat icon={Factory} value={String(manufacturers)} label="Upstream manufacturers" />
          <HeroStat icon={FileCheck2} value={String(totalCoa)} label="Lab certificates on record" />
        </div>
      </div>
    </section>

    <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-8 sm:py-10">
      <VendorsDirectory entries={entries} />
    </div>
  </>;
}

function HeroStat({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: string; label: string }) {
  return <div className="px-4 py-3.5"><Icon className="size-4 text-[#5a4be0]" /><p className="mt-2 text-2xl font-extrabold tabular-nums tracking-[-.04em]">{value}</p><p className="mt-0.5 text-[11px] font-semibold leading-4 text-[var(--muted)]">{label}</p></div>;
}

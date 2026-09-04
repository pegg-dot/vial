import type { Metadata } from "next";
import { FileCheck2, Factory, Store } from "lucide-react";
import { getVendorDirectory } from "@/server/vendors/directory";
import { getCertificatesOnRecord } from "@/server/public-repository";
import { VendorsDirectory } from "@/components/vendors-directory";
import { DataUnavailable } from "@/components/home-data-unavailable";
import { ArtMagnifierVial, ArtShieldCheck, ArtDroplet } from "@/components/vial-art";
import { reportError } from "@/server/observability/alerts";

export const metadata: Metadata = { title: "Vendor directory", description: "Rank peptide vendors by what matters to you — reliability, price, purity, testing, or reputation — from real evidence.", alternates: { canonical: "/vendors" } };
export const dynamic = "force-dynamic";

// Vendors signature = light violet — the "records" tint, same warm-paper register as every other
// hero (market = mint). The headline scale, padding, and floating art match Compounds/Market/News
// exactly: this hero once ran ~60% of its siblings' size and read as a different site.
export default async function VendorsPage() {
  // Guard BEFORE deriving anything — the counts below read `entries` directly.
  const entries = await getVendorDirectory().catch((error) => { reportError({ kind: "vendors-unavailable", message: "The vendor directory could not be read.", context: { error: String(error) } }); return null; });
  const totalCoa = await getCertificatesOnRecord().catch(() => null);   // site-wide corpus, not the vendor-matched subset
  if (!entries || totalCoa === null) return <DataUnavailable surface="the vendor directory" />;
  const storefronts = entries.filter((e) => e.vendor.kind !== "manufacturer").length;
  const manufacturers = entries.filter((e) => e.vendor.kind === "manufacturer").length;

  return <>
    <section className="relative isolate overflow-hidden border-b-2 border-[#111214] bg-[#e6efff]">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <ArtMagnifierVial className="gum-float absolute right-[5%] top-[16%] hidden w-24 drop-shadow-[5px_5px_0_#111214] sm:block lg:w-32" />
        <ArtShieldCheck className="gum-float-slow absolute right-[16%] bottom-[12%] hidden w-16 drop-shadow-[4px_4px_0_#111214] lg:block" />
        <ArtDroplet className="gum-float-rev absolute right-[25%] top-[26%] hidden w-11 drop-shadow-[3px_3px_0_#111214] lg:block" fill="#2b31d8" />
      </div>
      <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20">
        <div className="max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Vendor directory</p>
          <h1 className="mt-4 text-balance text-[clamp(2.8rem,7vw,5.5rem)] font-extrabold leading-[.9] tracking-[-.05em]">Rank every vendor by <span className="text-[#2b31d8]">what you care about.</span></h1>
          <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-[#111214]/70">Most reliable, cheapest, purest, most-tested, best-reviewed &mdash; sorted from lab records and public evidence, not marketing. A shady seller can rebrand overnight; the record follows them.</p>
        </div>
        {/* Plain masthead figures — numbers sit on the page, not in a box. */}
        <div className="mt-9 flex flex-wrap gap-x-12 gap-y-5">
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
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-1 size-4 shrink-0 text-[#2b31d8]" />
      <div>
        <p className="text-3xl font-extrabold tabular-nums leading-none tracking-[-.04em]">{value}</p>
        <p className="mt-1.5 text-[11px] font-semibold text-[var(--muted)]">{label}</p>
      </div>
    </div>
  );
}

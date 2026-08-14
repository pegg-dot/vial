import type { Metadata } from "next";
import { FileCheck2, Factory, Store } from "lucide-react";
import { VialBuddy, ArtShieldCheck, ArtCoa } from "@/components/vial-art";
import { getVendorDirectory } from "@/server/vendors/directory";
import { getCertificatesOnRecord } from "@/server/public-repository";
import { VendorsDirectory } from "@/components/vendors-directory";

export const metadata: Metadata = { title: "Vendor directory", description: "Rank peptide vendors by what matters to you — reliability, price, purity, testing, or reputation — from real evidence.", alternates: { canonical: "/vendors" } };
export const dynamic = "force-dynamic";

// Vendors signature = cool steel/slate — the "records vault." Hardened cards, shield/record stickers.
const STEEL = "#39414e";

export default async function VendorsPage() {
  const entries = await getVendorDirectory();
  const storefronts = entries.filter((e) => e.vendor.kind !== "manufacturer").length;
  const manufacturers = entries.filter((e) => e.vendor.kind === "manufacturer").length;
  const totalCoa = await getCertificatesOnRecord();   // site-wide corpus, not the vendor-matched subset

  return <>
    <section className="relative isolate overflow-hidden border-b-2 border-[#111214] text-white" style={{ background: STEEL }}>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <ArtCoa className="gum-float-slow absolute right-[5%] top-[12%] hidden w-20 drop-shadow-[5px_5px_0_#111214] sm:block lg:w-24" />
        <ArtShieldCheck className="gum-float absolute right-[15%] top-[40%] hidden w-[72px] drop-shadow-[5px_5px_0_#111214] lg:block" />
        <VialBuddy className="gum-float-rev absolute right-[6%] top-[46%] hidden w-16 drop-shadow-[4px_4px_0_#111214] lg:block" liquid="#8fffd6" cap="#111214" />
      </div>
      <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20">
        <div className="max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#9fe8d8]">Vendor directory</p>
          <h1 className="mt-4 text-balance text-[clamp(2.2rem,5vw,3.75rem)] font-extrabold leading-[.95] tracking-[-.045em]">Rank every vendor by <span className="text-[#8fffd6]">what you care about.</span></h1>
          <p className="mt-5 max-w-2xl text-lg font-medium leading-8 text-white/75">Most reliable, cheapest, purest, most-tested, best-reviewed &mdash; sorted from real evidence, not marketing. A shady seller can spin up a new site overnight; we keep the record so a fresh coat of paint can&rsquo;t hide it.</p>
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          <HeroStat icon={Store} value={String(storefronts)} label="Storefronts you can shop" />
          <HeroStat icon={Factory} value={String(manufacturers)} label="Upstream manufacturers" />
          <HeroStat icon={FileCheck2} value={String(totalCoa)} label="Lab certificates on record" />
        </div>
      </div>
    </section>

    <div className="mx-auto max-w-[1320px] px-5 py-12 sm:px-8 sm:py-14">
      <VendorsDirectory entries={entries} />
    </div>
  </>;
}

function HeroStat({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: string; label: string }) {
  return <div className="ink hard rounded-[18px] bg-white p-5 text-[#111214]"><Icon className="size-4 text-[#39414e]" /><p className="mt-4 text-3xl font-extrabold tracking-[-.05em]">{value}</p><p className="mt-1 text-xs font-semibold text-[var(--muted)]">{label}</p></div>;
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Building2, ExternalLink, ShieldCheck } from "lucide-react";
import { ArtShieldCheck, VialBuddy, ArtDroplet } from "@/components/vial-art";
import reference from "../../../scripts/data/reference-manufacturers.json";

export const metadata: Metadata = {
  title: "The reference standard — pharmaceutical-grade peptide manufacturing",
  description: "Who actually makes peptides under regulated cGMP conditions, and how that differs from the grey market. Context for judging any research-peptide source.",
};

export default function ReferenceStandardPage() {
  const { manufacturers, gmpVsGreyMarket } = reference;
  return (
    <>
      <section className="relative isolate overflow-hidden border-b-2 border-[#111214] bg-[#eaf0ff]">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <ArtShieldCheck className="gum-float absolute right-[6%] top-[20%] hidden w-24 drop-shadow-[5px_5px_0_#111214] sm:block lg:w-28" />
          <VialBuddy className="gum-float-slow absolute right-[17%] bottom-[10%] hidden w-16 drop-shadow-[4px_4px_0_#111214] lg:block" liquid="#2b31d8" />
          <ArtDroplet className="gum-float-rev absolute right-[26%] top-[26%] hidden w-11 drop-shadow-[3px_3px_0_#111214] lg:block" fill="#2b31d8" />
        </div>
        <div className="mx-auto max-w-[1320px] px-5 py-14 sm:px-8 sm:py-16">
          <Link href="/compounds" className="inline-flex items-center gap-2 text-sm font-bold text-[#111214]/60 transition hover:text-[#111214]"><ArrowLeft className="size-4" /> All compounds</Link>
          <div className="mt-8 max-w-3xl">
            <span className="ink-1 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[.14em] text-[#2b31d8]"><ShieldCheck className="size-3" /> Reference standard</span>
            <h1 className="mt-5 text-balance text-[clamp(2.6rem,6.2vw,5rem)] font-extrabold leading-[.9] tracking-[-.05em]">What <span className="text-[#2b31d8]">&ldquo;pharmaceutical-grade&rdquo;</span> actually means</h1>
            <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-[#111214]/70">Grey-market vendors borrow the language of legitimacy — &ldquo;99% pure,&rdquo; &ldquo;lab tested,&rdquo; &ldquo;GMP.&rdquo; This page shows the real thing: the regulated manufacturers whose peptides go into approved medicines, so you have a true benchmark to judge everything else against.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-12 sm:px-8 sm:py-16">
        <div className="ink hard rounded-[20px] bg-white p-6 sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#2b31d8]">GMP vs. the grey market</p>
          <p className="mt-4 text-base font-medium leading-8 text-black/80">{gmpVsGreyMarket}</p>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 pb-16 sm:px-8 sm:pb-24">
        <div className="mb-7">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Regulated manufacturers</p>
          <h2 className="mt-3 text-[clamp(2rem,4.5vw,3.4rem)] font-extrabold leading-[.96] tracking-[-.045em]">Who makes the real thing</h2>
          <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[var(--muted)]">Publicly documented, regulator-inspected peptide manufacturers. VIAL does not sell these or claim any grey-market vendor sources from them — they are here purely as a reference point.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {manufacturers.map((m) => (
            <div key={m.slug} className="ink-1 hard flex flex-col gap-3 rounded-[18px] bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="ink-1 grid size-9 place-items-center rounded-xl bg-[#eef0ff]"><Building2 className="size-4 text-[#2b31d8]" /></span>
                    <h3 className="text-xl font-extrabold tracking-[-.03em]">{m.name}</h3>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-[var(--muted)]">{m.country} · {m.status}</p>
                </div>
                <a href={m.website} target="_blank" rel="noopener noreferrer" className="ink-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-black/60 transition hover:-translate-y-0.5">site <ExternalLink className="size-3" /></a>
              </div>
              <p className="text-sm font-medium leading-6 text-black/75">{m.role}</p>
              <div className="ink-1 mt-1 grid gap-2 rounded-2xl bg-[var(--background)] p-4 text-[13px] leading-5">
                <p><span className="font-bold text-black/60">Makes:</span> <span className="font-medium text-black/70">{m.makes}</span></p>
                <p><span className="font-bold text-black/60">Regulatory:</span> <span className="font-medium text-black/70">{m.regulatory}</span></p>
              </div>
            </div>
          ))}
        </div>

        <div className="ink hard mt-10 rounded-[18px] bg-[#fff6e6] p-6 sm:p-7">
          <p className="text-sm font-medium leading-7 text-[#111214]/80"><span className="font-extrabold">The honest takeaway:</span> a grey-market vendor posting a high-purity COA is not the same as a regulated manufacturer with an inspected, traceable, released batch behind an approved drug. Purity on a certificate is one data point — it says nothing about sterility, dose accuracy, contaminants, or whether the tested vial matches the one shipped to you. Use the manufacturers above as the bar, and treat everything else as what it is: unregulated material sold on trust.</p>
        </div>
      </section>
    </>
  );
}

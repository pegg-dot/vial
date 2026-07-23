import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Building2, ExternalLink, ShieldCheck } from "lucide-react";
import reference from "../../../scripts/data/reference-manufacturers.json";

export const metadata: Metadata = {
  title: "The reference standard — pharmaceutical-grade peptide manufacturing",
  description: "Who actually makes peptides under regulated cGMP conditions, and how that differs from the grey market. Context for judging any research-peptide source.",
};

export default function ReferenceStandardPage() {
  const { manufacturers, gmpVsGreyMarket } = reference;
  return (
    <>
      <section className="border-b border-black/[.06]">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8 sm:py-16">
          <Link href="/compounds" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-black"><ArrowLeft className="size-4" /> Back to compounds</Link>
          <div className="mt-8 max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700"><ShieldCheck className="size-3" /> Reference standard</span>
            <h1 className="mt-5 text-5xl font-semibold leading-[.95] tracking-[-.06em] sm:text-6xl">What &ldquo;pharmaceutical-grade&rdquo; actually means</h1>
            <p className="mt-6 text-base leading-7 text-[var(--muted)] sm:text-lg">Grey-market vendors borrow the language of legitimacy — &ldquo;99% pure,&rdquo; &ldquo;lab tested,&rdquo; &ldquo;GMP.&rdquo; This page shows the real thing: the regulated manufacturers whose peptides go into approved medicines, so you have a true benchmark to judge everything else against.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-12 sm:px-8 sm:py-16">
        <div className="rounded-[28px] border border-black/[.08] bg-white p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[var(--muted)]">GMP vs. the grey market</p>
          <p className="mt-4 text-base leading-8 text-black/80">{gmpVsGreyMarket}</p>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 pb-16 sm:px-8 sm:pb-24">
        <div className="mb-7">
          <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Regulated manufacturers</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-.045em]">Who makes the real thing</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Publicly documented, regulator-inspected peptide manufacturers. VIAL does not sell these or claim any grey-market vendor sources from them — they are here purely as a reference point.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {manufacturers.map((m) => (
            <div key={m.slug} className="flex flex-col gap-3 rounded-[26px] border border-black/[.07] bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="grid size-9 place-items-center rounded-xl bg-black/[.045]"><Building2 className="size-4 text-black/50" /></span>
                    <h3 className="text-xl font-semibold tracking-[-.03em]">{m.name}</h3>
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted)]">{m.country} · {m.status}</p>
                </div>
                <a href={m.website} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-full border border-black/[.1] px-3 py-1.5 text-[11px] font-semibold text-black/55 hover:border-black/25 hover:text-black">site <ExternalLink className="size-3" /></a>
              </div>
              <p className="text-sm leading-6 text-black/75">{m.role}</p>
              <div className="mt-1 grid gap-2 rounded-2xl bg-black/[.025] p-4 text-[13px] leading-5">
                <p><span className="font-semibold text-black/60">Makes:</span> <span className="text-black/70">{m.makes}</span></p>
                <p><span className="font-semibold text-black/60">Regulatory:</span> <span className="text-black/70">{m.regulatory}</span></p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-[24px] border border-amber-200 bg-amber-50/60 p-6">
          <p className="text-sm leading-7 text-amber-950/80"><span className="font-semibold">The honest takeaway:</span> a grey-market vendor posting a high-purity COA is not the same as a regulated manufacturer with an inspected, traceable, released batch behind an approved drug. Purity on a certificate is one data point — it says nothing about sterility, dose accuracy, contaminants, or whether the tested vial matches the one shipped to you. Use the manufacturers above as the bar, and treat everything else as what it is: unregulated material sold on trust.</p>
        </div>
      </section>
    </>
  );
}

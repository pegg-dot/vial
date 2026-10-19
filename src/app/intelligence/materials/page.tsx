import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, ClipboardCheck, FileSearch, FlaskConical, SearchCheck, ShieldAlert, Store } from "lucide-react";
import { MaterialReviewWorkbench } from "@/components/intelligence/material-review-workbench";
import { RESEARCH_PROVIDER_RECORDS } from "@/lib/research-materials";
import { researchSubjectBySlug } from "@/lib/research-explorer";

export const metadata: Metadata = {
  title: "Research materials and lot evidence | VialGrade",
  description: "Explore peptide identities, material verification requirements and company-published quality documentation. No shopping or verified batch claims.",
  robots: { index: false, follow: false },
};

export default async function ResearchMaterialsPage({ searchParams }: {
  searchParams: Promise<{ subject?: string | string[] }>;
}) {
  const params = await searchParams;
  const request = typeof params.subject === "string" ? params.subject : "pexiganan";
  const initialSlug = researchSubjectBySlug(request) ? request : "pexiganan";
  return (
    <main className="bg-[#faf9f7] pb-24">
      <div className="mx-auto max-w-[1180px] px-5 pt-8 sm:px-8">
        <nav aria-label="Research materials breadcrumb" className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#688074]">
          <Link href="/intelligence" className="hover:underline">Research Market</Link><span>/</span>
          <span aria-current="page" className="text-[#216554]">Research materials</span>
        </nav>
        <header className="relative mt-7 overflow-hidden rounded-[23px] border-2 border-[#17191b] bg-[#e9fff1] p-6 sm:p-9">
          <div className="pointer-events-none absolute -right-16 top-0 size-72 rounded-full border-2 border-[#17191b]/10" aria-hidden="true" />
          <div className="relative max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#17191b] bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[.12em] text-[#287561]">
              <ClipboardCheck className="size-4" /> The material side of the Research Market
            </p>
            <h1 className="mt-5 text-[clamp(2.5rem,5vw,4.4rem)] font-extrabold leading-[1.05] tracking-[-.055em] text-[#17191b]">
              Research the molecule.<br /><span className="text-[#17816d]">Verify the material.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-[#4e705f] sm:text-base">
              A scientific paper cannot tell you what&apos;s in a particular vial. Browse peptide identities, compare the evidence associated with a specific research lot and inspect where supplier quality claims came from.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#material-index" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#17191b] px-5 py-3 text-xs font-extrabold text-white hover:bg-[#383839]">
                Browse material files <ArrowRight className="size-4" />
              </a>
              <Link href="/intelligence/providers" className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-[#17191b] bg-white px-5 py-3 text-xs font-extrabold text-[#17191b] hover:bg-[#f3fdf6]">
                View supplier documentation <ArrowUpRight className="size-4" />
              </Link>
            </div>
          </div>
        </header>
        <section aria-label="Material evidence summary" className="mt-5 grid gap-3 sm:grid-cols-3">
          {([
            { value: "16", label: "Scientific identities to investigate", icon: FlaskConical },
            { value: "0", label: "Physical lots independently authenticated", icon: SearchCheck },
            { value: String(RESEARCH_PROVIDER_RECORDS.length), label: "Public manufacturer QC profiles, not endorsements", icon: Store },
          ] as const).map(({ value, label, icon: Icon }) => (
            <div key={label} className="flex items-center gap-4 rounded-2xl border border-[#dbe5dd] bg-white p-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#edf7f0]"><Icon className="size-5 text-[#227263]" /></span>
              <div><p className="text-2xl font-black tabular-nums text-[#20332a]">{value}</p><p className="mt-0.5 text-xs leading-5 text-[#728078]">{label}</p></div>
            </div>
          ))}
        </section>
        <p className="mt-4 flex items-start gap-2 text-xs leading-6 text-[#797b70]">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[#987c47]" />
          Read-only research due diligence. No purchase, referral, stock, legal-use certification, quality grade or physical sample is offered. A &quot;research use only&quot; label does not by itself establish lawful drug marketing.
        </p>
        <div className="mt-12"><MaterialReviewWorkbench initialSlug={initialSlug} /></div>

        <section id="material-providers" className="mt-14 scroll-mt-32">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.13em] text-[#188475]">The old vendor directory, rebuilt carefully</p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-[-.04em] text-[#17191b]">Who publishes the quality information?</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#67766d]">Two organization profiles show first-party documentation about general peptide QC practices. Neither is independently verified by VialGrade or linked to the availability of any molecule in this catalog.</p>
            </div>
            <Link href="/intelligence/providers" className="inline-flex items-center gap-2 text-xs font-extrabold text-[#237763] hover:underline">Full source directory <ArrowRight className="size-4" /></Link>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {RESEARCH_PROVIDER_RECORDS.map(provider => (
              <article key={provider.slug} className="rounded-[18px] border-2 border-[#17191b] bg-white p-6 shadow-[4px_5px_0_rgba(23,25,27,0.09)]">
                <div className="flex items-center justify-between gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-[#e7f7e9]"><Store className="size-5 text-[#347461]" /></span>
                  <span className="rounded-full bg-[#fff5e1] px-3 py-1.5 text-[10px] font-extrabold text-[#99713d]">Issuer claims only</span>
                </div>
                <p className="mt-4 text-xs font-bold text-[#56776a]">{provider.category}</p>
                <h3 className="mt-1 text-xl font-extrabold tracking-[-.035em] text-[#202821]">{provider.name}</h3>
                <p className="mt-2 text-sm leading-6 text-[#687870]">{provider.summary}</p>
                <Link href={"/intelligence/providers/" + provider.slug} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#17191b] px-4 py-2.5 text-xs font-extrabold text-white hover:bg-[#383939]">
                  Inspect quality sources <ArrowRight className="size-4" />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 grid gap-4 rounded-[19px] border border-[#d7e5d9] bg-[#f0f7f1] p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
          <div>
            <h2 className="text-lg font-extrabold text-[#314d3d]">Scientific promise and sample verification are different questions.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#657c6a]">The research-file A/B/C grades describe linked primary-source layers. They do not certify an experiment&apos;s conclusions, a supplier, or a lot.</p>
          </div>
          <Link href="/intelligence/grading" className="inline-flex min-h-11 items-center gap-2 text-xs font-extrabold text-[#25765d] hover:underline"><FileSearch className="size-4" /> See research grading</Link>
        </section>
        <Link href="/intelligence" className="mt-8 inline-flex items-center gap-2 text-xs font-bold text-[#347460] hover:underline"><ArrowLeft className="size-4" /> Back to Research Market</Link>
      </div>
    </main>
  );
}

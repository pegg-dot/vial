import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, Building2, FileCheck2, FlaskConical, ShieldAlert, Store } from "lucide-react";
import { RESEARCH_PROVIDER_RECORDS, MATERIAL_REVIEW_DATE } from "@/lib/research-materials";

export const metadata: Metadata = {
  title: "Research supplier documentation | VialGrade",
  description: "Source-linked public QC descriptions from professional peptide organizations. No endorsements, rankings, purchasing or independently authenticated batches.",
  robots: { index: false, follow: false },
};

export default function ResearchProvidersPage() {
  return (
    <main className="bg-[#faf9f7] pb-24">
      <div className="mx-auto max-w-[1100px] px-5 pt-8 sm:px-8">
        <nav aria-label="Supplier documentation breadcrumb" className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#718276]">
          <Link href="/intelligence" className="hover:underline">Research Market</Link><span>/</span>
          <span aria-current="page" className="text-[#236d57]">Supplier documentation</span>
        </nav>
        <header className="mt-7 border-b border-[#dce5df] pb-7">
          <h1 className="text-[clamp(2rem,4.4vw,3.2rem)] font-bold tracking-[-.055em] text-[#203629]">Research organizations</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#617469]">
            See what laboratories and manufacturers say about their quality processes, with links to the original company pages. VialGrade has not independently verified these organizations or any specific material lot.
          </p>
          <p className="mt-3 text-xs text-[#7b897e]">{RESEARCH_PROVIDER_RECORDS.length} company documentation profiles · Source notes dated {MATERIAL_REVIEW_DATE}</p>
        </header>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {RESEARCH_PROVIDER_RECORDS.map(provider => (
            <article key={provider.slug} className="flex flex-col rounded-[19px] border-2 border-[#17191b] bg-white p-6 shadow-[4px_5px_0_rgba(23,25,27,0.08)] sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <span className="grid size-12 place-items-center rounded-xl bg-[#e8f7ef]"><Store className="size-6 text-[#2b7861]" /></span>
                <span className="rounded-full border border-[#ebd6ad] bg-[#fff5e0] px-3 py-1.5 text-[10px] font-extrabold text-[#8c622c]">Independent checks pending</span>
              </div>
              <p className="mt-5 text-xs font-bold text-[#578473]">{provider.category}</p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-[-.04em] text-[#202622]">{provider.name}</h2>
              <p className="mt-3 flex-1 text-sm leading-7 text-[#66736e]">{provider.summary}</p>
              <div className="mt-5 rounded-xl border border-[#e1eae3] bg-[#f8fbf9] p-4">
                <div className="flex items-center gap-2 text-xs font-extrabold text-[#347460]"><FileCheck2 className="size-4" /> Publicly documented</div>
                <p className="mt-2 text-xs leading-6 text-[#718076]">{provider.publishedMethod}</p>
                <p className="mt-2 text-xs font-bold text-[#9b7041]">Based on the organization&apos;s own site, not independent confirmation.</p>
              </div>
              <Link href={"/intelligence/providers/" + provider.slug} className="mt-6 inline-flex min-h-11 w-fit items-center gap-2 rounded-xl bg-[#17191b] px-5 py-3 text-xs font-extrabold text-white hover:bg-[#393c3c]">
                Open source profile <ArrowRight className="size-4" />
              </Link>
            </article>
          ))}
        </div>
        <section className="mt-9 grid gap-4 rounded-2xl border border-[#e8dbc1] bg-[#fff8e7] p-6 sm:p-7">
          <div className="flex items-center gap-2 text-[#8a6936]"><ShieldAlert className="size-5" /><h2 className="text-base font-extrabold">What this directory can and cannot tell you</h2></div>
          <p className="text-sm leading-7 text-[#806d4c]">We can show the specific statements a company makes about its analytical methods and documentation, with a link to the original page. We cannot currently validate its QC performance, independent accreditations, sample identity, current product availability, supply relationship to a specific peptide, or the authenticity of a particular COA. No names here constitute a preferred-supplier list.</p>
        </section>
        <nav aria-label="Related research workflows" className="mt-7 grid gap-3 sm:grid-cols-2">
          <Link href="/intelligence/materials" className="rounded-xl border border-[#d7e5dc] bg-white p-5 hover:border-[#33836b]">
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#305c49]"><FlaskConical className="size-4" /> Material evidence workbench <ArrowUpRight className="size-4" /></h3>
            <p className="mt-2 text-xs leading-6 text-[#708075]">Compare sample and report lot IDs locally; export an explicitly unverified workpaper.</p>
          </Link>
          <Link href="/intelligence/organizations" className="rounded-xl border border-[#d7e5dc] bg-white p-5 hover:border-[#33836b]">
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#305c49]"><Building2 className="size-4" /> Trial sponsor attribution <ArrowUpRight className="size-4" /></h3>
            <p className="mt-2 text-xs leading-6 text-[#708075]">Sponsors shown in clinical registries are not necessarily manufacturers or material suppliers.</p>
          </Link>
        </nav>
        <Link href="/intelligence" className="mt-8 inline-flex items-center gap-2 text-xs font-bold text-[#377563] hover:underline"><ArrowLeft className="size-4" /> Back to Research Market</Link>
      </div>
    </main>
  );
}

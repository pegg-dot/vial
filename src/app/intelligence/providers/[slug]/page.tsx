import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2, CircleHelp, ExternalLink, FileSearch, ShieldAlert } from "lucide-react";
import { MATERIAL_EVIDENCE_REQUIREMENTS, MATERIAL_REVIEW_DATE, researchProviderBySlug } from "@/lib/research-materials";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const provider = researchProviderBySlug(slug);
  return {
    title: provider ? provider.name + " public QC documentation | VialGrade" : "Source record not found | VialGrade",
    description: "Review original company-authored quality statements, with clear limits on material and certificate authentication.",
    robots: { index: false, follow: false },
  };
}

export default async function ResearchProviderProfile({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const provider = researchProviderBySlug(slug);
  if (!provider) notFound();
  return (
    <main className="bg-[#faf9f7] pb-24">
      <div className="mx-auto max-w-[1000px] px-5 pt-8 sm:px-8">
        <nav aria-label="Provider source profile breadcrumb" className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#6e7d76]">
          <Link href="/intelligence" className="hover:underline">Research Market</Link><span>/</span>
          <Link href="/intelligence/providers" className="hover:underline">Supplier documentation</Link><span>/</span>
          <span aria-current="page" className="text-[#276f59]">{provider.name}</span>
        </nav>
        <header className="mt-7 overflow-hidden rounded-[22px] border-2 border-[#17191b] bg-white">
          <div className="bg-[#e9fff1] p-6 sm:p-9">
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[.13em] text-[#227865]"><Building2 className="size-4" /> Public organization dossier</p>
            <h1 className="mt-4 text-[clamp(2.4rem,5vw,4rem)] font-extrabold tracking-[-.06em] text-[#17191b]">{provider.name}</h1>
            <p className="mt-2 text-sm font-semibold text-[#46745d]">{provider.category}</p>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[#537264]">{provider.summary}</p>
          </div>
          <div className="grid gap-0 border-t-2 border-[#17191b] sm:grid-cols-3">
            {[
              ["Company source", "Public process description"],
              ["Independent quality review", "Not performed"],
              ["Lot-linked report", "Not authenticated"],
            ].map(([label, value]) => (
              <div key={label} className="border-b border-[#e5e9e6] p-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
                <p className="text-[11px] font-bold uppercase tracking-[.08em] text-[#899087]">{label}</p>
                <p className="mt-2 text-sm font-extrabold text-[#304e40]">{value}</p>
              </div>
            ))}
          </div>
        </header>
        <div className="mt-8 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
          <section aria-labelledby="source-profile-title" className="rounded-2xl border border-[#dce7df] bg-white p-6 sm:p-7">
            <div className="flex items-center gap-2 text-[#2c755d]"><FileSearch className="size-5" /><h2 id="source-profile-title" className="text-xl font-extrabold">Follow the original documentation</h2></div>
            <p className="mt-3 text-sm leading-7 text-[#697c70]">{provider.publishedMethod}</p>
            <p className="mt-2 text-xs font-bold text-[#956a36]">Source class: COMPANY-AUTHORED. These observations describe published claims, not independently established facts.</p>
            <div className="mt-6 space-y-3">
              {provider.sources.map((source, index) => (
                <div key={source.url} className="rounded-xl border border-[#d8e3db] bg-[#fafcfb] p-4">
                  <div className="flex gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#e0f1e4] text-xs font-extrabold text-[#36765c]">{index + 1}</span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-extrabold text-[#314639]">{source.title}</h3>
                      <p className="mt-1 text-xs text-[#839087]">Reference noted {source.observed} · First-party source</p>
                      <a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#2a7661] underline underline-offset-3 break-all">
                        Open original company page <ExternalLink className="size-3.5 shrink-0" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <aside className="rounded-2xl border border-[#ebddbd] bg-[#fff9eb] p-6">
            <div className="flex items-center gap-2 text-[#986f3a]"><ShieldAlert className="size-5" /><h2 className="text-lg font-extrabold">Verification is not complete</h2></div>
            <p className="mt-3 text-sm leading-7 text-[#856a44]">{provider.importantLimit}</p>
            <p className="mt-4 text-xs font-bold text-[#957750]">As-of review: {MATERIAL_REVIEW_DATE}</p>
            <Link href="/intelligence/materials" className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[#c3ab82] bg-white px-4 py-3 text-xs font-extrabold text-[#806132] hover:bg-[#fff0cd]">Review a material lot <ArrowRight className="size-4" /></Link>
          </aside>
        </div>
        <section className="mt-7 rounded-2xl border border-[#d9e4da] bg-white p-6 sm:p-7">
          <div className="flex items-center gap-2 text-[#286952]"><CircleHelp className="size-5" /><h2 className="text-lg font-extrabold">What is missing before a specific research material is verifiable?</h2></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {MATERIAL_EVIDENCE_REQUIREMENTS.map(check => (
              <div key={check.id} className="rounded-xl border border-[#e0e9e0] bg-[#f9fbf9] p-4">
                <p className="text-xs font-extrabold text-[#32523e]">{check.title}</p>
                <p className="mt-1 text-xs leading-6 text-[#728075]">{check.question}</p>
                <p className="mt-2 text-[11px] font-bold text-[#a17a41]">Not established for any lot in this dossier</p>
              </div>
            ))}
          </div>
        </section>
        <p className="mt-6 max-w-4xl text-xs leading-6 text-[#829088]">This is a read-only quality-source audit, not vendor certification, material availability, accreditation verification, a scientific effectiveness score, or an invitation to purchase. A company profile is not evidence that it made the molecule in any VialGrade dossier.</p>
        <Link href="/intelligence/providers" className="mt-7 inline-flex items-center gap-2 text-xs font-bold text-[#33735d] hover:underline"><ArrowLeft className="size-4" /> Back to supplier documentation</Link>
      </div>
    </main>
  );
}

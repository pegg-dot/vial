import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BookOpenCheck, CheckCircle2,
  ChevronDown, ClipboardList, Dna, ExternalLink, FlaskConical, Link2, ShieldAlert,
} from "lucide-react";
import {
  guidedCaseMarkdown, guidedCaseSource, MAGAININ_PEXIGANAN_CASE,
  type GuidedResearchSource,
} from "@/lib/research-guided-case";
import { ResearchWorkpaperActions } from "@/components/intelligence/research-workpaper-actions";
import { PEXIGANAN_REVIEW_DATE } from "@/lib/pexiganan-evidence-network";

export const metadata: Metadata = {
  title: "Magainin 2 vs pexiganan: trace the evidence | VialGrade",
  description: "An illustrated, source-linked scientific review comparing original magainin research, the designed analog pexiganan and a specific registered clinical trial.",
  robots: { index: false, follow: false },
};

const roleNames: Record<GuidedResearchSource["type"], string> = {
  "molecular-identity": "Molecular record",
  "original-experiment": "Primary experiment",
  "secondary-review": "Scientific review",
  "registered-study": "Official trial record",
};

export default function MagaininPexigananGuidedCase() {
  const caseStudy = MAGAININ_PEXIGANAN_CASE;
  return (
    <main className="bg-[#faf9f7] pb-20">
      <div className="mx-auto max-w-[1110px] px-5 pt-8 sm:px-8">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#827f91]">
          <Link href="/intelligence#explore" className="hover:text-[#5a499e] hover:underline">Research Explorer</Link>
          <span aria-hidden="true">/</span><span aria-current="page" className="text-[#4f496e]">Guided research example</span>
        </nav>
        <section className="mt-6 overflow-hidden rounded-[25px] border border-[#d6d9e2] bg-white">
          <div className="relative bg-[#e9f5ef] px-6 py-8 sm:px-10 sm:py-12">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-[#227467]">
              <Dna className="size-4" /> Guided evidence workpaper
            </div>
            <h1 className="mt-5 max-w-3xl text-[clamp(2.35rem,5vw,4.35rem)] font-semibold leading-[1.08] tracking-[-.065em] text-[#223e41]">
              When related peptides are not the same evidence.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-[#476364]">{caseStudy.question}</p>
            <Link href="/intelligence/passports/pexiganan" className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#b9dacc] bg-[#f1fbf5] px-3 py-2 text-xs font-bold text-[#226d56] hover:underline">
              Expanded Pexiganan evidence passport · source check {PEXIGANAN_REVIEW_DATE} <ArrowRight className="size-3.5" />
            </Link>
            <div className="mt-7 flex flex-wrap gap-2">
              <Link href="/intelligence/compare?subjects=magainin-2%2Cpexiganan&audience=researcher"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#205e59] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#277a70]">
                Compare the molecules <ArrowRight className="size-4" />
              </Link>
              <Link href="/intelligence/studies/NCT01594762"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#afd0c5] bg-white px-5 py-2.5 text-sm font-semibold text-[#28645e] hover:bg-[#f4fffa]">
                Inspect the clinical trial <ArrowUpRight className="size-4" />
              </Link>
            </div>
          </div>
          <div className="border-t border-[#dfe9e5] px-6 py-6 sm:px-10 sm:py-7">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.1em] text-[#5f6e72]"><CheckCircle2 className="size-4" /> The short answer</div>
            <p className="mt-2 max-w-4xl text-base font-medium leading-8 text-[#2d4346]">{caseStudy.shortAnswer}</p>
            <p className="mt-3 text-xs leading-6 text-[#7c8589]">Three observations from original molecular records, a biophysical experiment, a secondary scientific review and an official trial registration. This is not an exhaustive literature review.</p>
          </div>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_290px] lg:items-start">
          <div className="space-y-6">
            <section aria-labelledby="evidence-trail-heading" className="space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.12em] text-[#5c7391]">Trace the original evidence</p>
                <h2 id="evidence-trail-heading" className="mt-2 text-2xl font-semibold tracking-[-.045em] text-[#272c3b]">Three things the sources actually establish</h2>
                <p className="mt-2 text-sm leading-7 text-[#737988]">Every step keeps its own supporting sources and its own limitations. No claim inherits evidence merely because the peptide names are similar.</p>
              </div>
              {caseStudy.observations.map((observation, index) => (
                <article key={observation.id} className="overflow-hidden rounded-2xl border border-[#e0e3e9] bg-white">
                  <div className="flex gap-4 p-5 sm:p-7">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#ebf4f2] text-sm font-bold text-[#247a6f]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold tracking-[-.03em] text-[#2b3540]">{observation.short}</h3>
                      <p className="mt-3 text-sm leading-7 text-[#525f67]">{observation.observation}</p>
                      <div className="mt-4 rounded-xl bg-[#fff9ec] p-4">
                        <p className="text-[11px] font-bold uppercase tracking-[.09em] text-[#9c792f]">Important limitation</p>
                        <p className="mt-1.5 text-sm leading-6 text-[#706552]">{observation.notEstablished}</p>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-[#eceef1] bg-[#fcfcfd] px-5 py-4 sm:px-7">
                    <p className="text-[11px] font-bold uppercase tracking-[.09em] text-[#8a8a99]">Supporting original sources</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                      {observation.sourceIds.map(id => {
                        const source = guidedCaseSource(id);
                        return source ? <a key={id} href={source.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4f6291] underline underline-offset-2 hover:text-[#293f69]">
                          {roleNames[source.type]}{source.type === "molecular-identity" ? (source.id === "magainin-identity" ? " · Magainin 2" : " · Pexiganan") : ""} <ArrowUpRight className="size-3" />
                        </a> : null;
                      })}
                    </div>
                  </div>
                </article>
              ))}
            </section>

            <details className="group overflow-hidden rounded-2xl border border-[#e0e3e9] bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 [&::-webkit-details-marker]:hidden">
                <div>
                  <div className="flex items-center gap-2"><BookOpenCheck className="size-4 text-[#5a6e9d]" /><h2 className="text-lg font-semibold text-[#303348]">Full source register · 5 records</h2></div>
                  <p className="mt-2 text-sm leading-6 text-[#7b7d89]">Expand source details, classifications and specific limitations.</p>
                </div>
                <ChevronDown className="size-4 shrink-0 text-[#6a628e] transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-[#eceef2]">
              {caseStudy.sources.map(source => (
                <article key={source.id} className="border-b border-[#f0f0f3] px-6 py-4 last:border-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold uppercase tracking-[.08em] text-[#807696]">{roleNames[source.type]}</span>
                      <h3 className="mt-1 text-sm font-semibold leading-6 text-[#34374a]">{source.label}</h3>
                      <p className="mt-1 text-xs leading-6 text-[#777b87]">{source.detail}</p>
                      <p className="mt-1 text-xs leading-6 text-[#937949]">Limit: {source.limitation}</p>
                    </div>
                    <a href={source.url} target="_blank" rel="noopener noreferrer" aria-label={"Open original source: " + source.label}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#e0e1e9] px-3 py-2 text-xs font-semibold text-[#596099] hover:bg-[#f7f6ff]">
                      Open <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                </article>
              ))}
              </div>
            </details>

            <section className="rounded-2xl border border-[#dcdfe6] bg-[#f7f7fa] p-6 sm:p-7">
              <div className="flex items-center gap-2"><ClipboardList className="size-5 text-[#5d548f]" /><h2 className="text-lg font-semibold text-[#2f3045]">Continue the actual research</h2></div>
              <ol className="mt-4 list-inside list-decimal space-y-3 text-sm leading-7 text-[#616575]">
                {caseStudy.followUps.map((item, i) => <li key={i}>{item}</li>)}
              </ol>
              <div className="mt-6 border-t border-[#e2e2e9] pt-5">
                <h3 className="text-sm font-semibold text-[#32334b]">Export the evidence, not just an AI answer</h3>
                <p className="mt-1.5 text-xs leading-6 text-[#797d89]">A copyable Markdown workpaper with observed claims, original URLs and unresolved questions. Nothing is saved to your account.</p>
                <div className="mt-4">
                  <ResearchWorkpaperActions markdown={guidedCaseMarkdown()} filename="vialgrade-magainin-pexiganan-evidence-workpaper.md" />
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-28">
            <section className="rounded-2xl border border-[#dedfe8] bg-white p-6">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.1em] text-[#5b528a]"><FlaskConical className="size-4" /> Molecules under review</div>
              <div className="mt-4 space-y-3">
                <Link href="/intelligence/explore/magainin-2" className="flex items-center justify-between rounded-xl bg-[#eef7f4] px-4 py-3 text-sm font-semibold text-[#236b63] hover:bg-[#ddefe8]">Magainin 2 <ArrowRight className="size-4" /></Link>
                <Link href="/intelligence/explore/pexiganan" className="flex items-center justify-between rounded-xl bg-[#eef7f4] px-4 py-3 text-sm font-semibold text-[#236b63] hover:bg-[#ddefe8]">Pexiganan / MSI-78 <ArrowRight className="size-4" /></Link>
              </div>
              <p className="mt-3 text-xs leading-6 text-[#7b7e8b]">Source links establish their separate molecular records. They are not a product catalog.</p>
            </section>
            <section className="rounded-2xl border border-[#e5d8c3] bg-[#fffaf1] p-6">
              <div className="flex items-center gap-2 text-[#986e26]"><ShieldAlert className="size-4" /><h2 className="text-sm font-semibold">Not a scientific verdict</h2></div>
              <p className="mt-3 text-xs leading-6 text-[#777162]">No independently reviewed efficacy conclusion, patient outcome interpretation, regulatory decision or approved material-sourcing recommendation. An expert still needs to appraise the trial findings and article quality.</p>
            </section>
            <section className="rounded-2xl border border-[#dedfe8] bg-white p-6">
              <div className="flex items-center gap-2 text-[#5e5b93]"><Link2 className="size-4" /><h2 className="text-sm font-semibold">Related evidence check</h2></div>
              <p className="mt-2 text-xs leading-6 text-[#777b88]">The source-audit tool separately checks whether the official pexiganan trial has posted registry results and which cited PubMed identifiers independently refer to the exact NCT.</p>
              <Link href="/intelligence/studies/NCT01594762" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#5a4c9a] hover:underline">Run the trial check <ArrowRight className="size-3.5" /></Link>
            </section>
          </aside>
        </div>
        <p className="mt-9 max-w-4xl text-xs leading-6 text-[#828592]">
          Source-check editorial review {caseStudy.updatedAt}. The workpaper is a limited research starting point; professional scientific review, publication-rights checks and user-demand validation remain open. Physical peptide sales and vendor referrals are disabled.
        </p>
        <Link href="/intelligence#explore" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#594f93] hover:underline"><ArrowLeft className="size-4" /> Return to Research Explorer</Link>
      </div>
    </main>
  );
}

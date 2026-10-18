import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpenText, ChevronDown, FileCheck2, Link2, ShieldCheck } from "lucide-react";
import { StudyLookupForm } from "@/components/intelligence/study-lookup-form";

export const metadata: Metadata = {
  title: "VialGrade | Check a clinical trial's evidence",
  description: "Enter an NCT trial ID to inspect its registry record, explicitly cited PubMed papers and unverified questions.",
  alternates: { canonical: "/intelligence" },
};

export default async function IntelligencePage({ searchParams }: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  return (
    <main className="bg-[#faf9f7]">
      {notice === "retired" && (
        <section role="status" className="border-b border-[#ecd9b8] bg-[#fff8ea]">
          <div className="mx-auto max-w-[1080px] px-5 py-4 text-sm leading-6 text-[#795620] sm:px-8">
            <strong>The old marketplace is inactive.</strong> Buying, seller listings, checkout and referrals are unavailable. Historical account access remains available for existing customers.
          </div>
        </section>
      )}

      <section className="border-b border-[#e6e3e7]">
        <div className="mx-auto grid max-w-[1080px] items-center gap-12 px-5 py-12 sm:px-8 sm:py-20 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#61569a]">VialGrade / Research workspace</p>
            <h1 className="mt-5 max-w-[600px] text-[clamp(2.7rem,5.2vw,4.5rem)] font-semibold leading-[1.08] tracking-[-.065em] text-[#232339]">
              Check a trial. Follow the evidence.
            </h1>
            <p className="mt-5 max-w-[540px] text-base leading-8 text-[#5f6271]">
              Paste a ClinicalTrials.gov study ID. See its registered results status, which papers the record cites, and which links PubMed independently confirms.
            </p>
            <div className="mt-8 rounded-[18px] border border-[#dedee7] bg-white p-5 shadow-[0_12px_40px_rgba(32,25,72,.05)] sm:p-6">
              <StudyLookupForm />
              <p className="mt-4 text-xs leading-6 text-[#717584]">
                Need an example?{" "}
                <Link href="/intelligence/studies/NCT05804162" className="font-semibold text-[#5748a7] underline underline-offset-4">
                  Try NCT05804162
                </Link>
                {" "}or paste an official study URL.
              </p>
            </div>
            <p className="mt-4 text-xs leading-6 text-[#858594]">Read-only research metadata. No account, purchases, health advice or personalized research tracking.</p>
          </div>

          <article className="overflow-hidden rounded-[20px] border border-[#d9d4ea] bg-white shadow-[0_16px_45px_rgba(48,35,101,.07)]">
            <div className="border-b border-[#e5e1ee] bg-[#f0edff] px-6 py-5">
              <p className="text-[11px] font-bold uppercase tracking-[.13em] text-[#6356a2]">Example source check · Oct 18, 2026</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-.03em] text-[#28243b]">One trial, two kinds of evidence</h2>
              <p className="mt-1 text-sm text-[#6f6a84]">Cagrilintide · NCT05804162</p>
            </div>
            <div className="space-y-0 px-6">
              <div className="flex gap-3 border-b border-[#ececf0] py-5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f5f5f8] text-[#6a657e]"><FileCheck2 className="size-4.5" /></span>
                <div>
                  <p className="text-xs font-semibold text-[#767989]">ClinicalTrials.gov</p>
                  <p className="mt-1 text-sm font-semibold text-[#282838]">No posted results section in the checked record</p>
                  <a href="https://clinicaltrials.gov/study/NCT05804162" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#5748a7] underline">View registry <ArrowUpRight className="size-3" /></a>
                </div>
              </div>
              <div className="flex gap-3 py-5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f0edff] text-[#6652b0]"><BookOpenText className="size-4.5" /></span>
                <div>
                  <p className="text-xs font-semibold text-[#767989]">PubMed</p>
                  <p className="mt-1 text-sm font-semibold text-[#282838]">A cited paper is indexed under the same trial ID</p>
                  <a href="https://pubmed.ncbi.nlm.nih.gov/39279639/" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#5748a7] underline">PMID 39279639 <ArrowUpRight className="size-3" /></a>
                </div>
              </div>
            </div>
            <Link href="/intelligence/studies/NCT05804162" className="flex items-center justify-between border-t border-[#ececf0] bg-[#fbfaff] px-6 py-4 text-sm font-semibold text-[#504291] hover:bg-[#f3f0ff]">
              Open the source check <ArrowRight className="size-4" />
            </Link>
          </article>
        </div>
      </section>

      <section id="workspace" className="mx-auto max-w-[1080px] scroll-mt-24 px-5 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#61569a]">What happens next</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-.035em] text-[#232339]">From source IDs to a usable brief</h2>
          </div>
          <p className="max-w-xs text-sm leading-6 text-[#707382]">One trial at a time. No generic AI verdict and no pretending the search is complete.</p>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[#e2e1e7] bg-white p-5">
            <FileCheck2 className="size-5 text-[#6659a4]" />
            <h3 className="mt-3 text-sm font-semibold text-[#282838]">See what the trial reports</h3>
            <p className="mt-2 text-sm leading-6 text-[#747682]">Study status, posted registry results and registered outcomes.</p>
          </div>
          <div className="rounded-xl border border-[#e2e1e7] bg-white p-5">
            <Link2 className="size-5 text-[#6659a4]" />
            <h3 className="mt-3 text-sm font-semibold text-[#282838]">Trace publication links</h3>
            <p className="mt-2 text-sm leading-6 text-[#747682]">See papers cited by the registry and exact trial-ID matches in PubMed.</p>
          </div>
          <div className="rounded-xl border border-[#e2e1e7] bg-white p-5">
            <ShieldCheck className="size-5 text-[#6659a4]" />
            <h3 className="mt-3 text-sm font-semibold text-[#282838]">Take a sourced brief</h3>
            <p className="mt-2 text-sm leading-6 text-[#747682]">Copy or download the original links, observations and open questions.</p>
          </div>
        </div>
      </section>

      <section id="method" className="scroll-mt-24 border-y border-[#e6e3e7] bg-white">
        <div className="mx-auto grid max-w-[1080px] gap-8 px-5 py-12 sm:px-8 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#61569a]">What this checks</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-.035em] text-[#232339]">Original records, with their limits visible.</h2>
            <p className="mt-3 text-sm leading-7 text-[#686b79]">
              VialGrade only verifies papers with PubMed identifiers explicitly listed in the study registry record. It does not discover every publication, assess the quality of the science, or show what changed between historic versions.
            </p>
          </div>
          <div className="rounded-xl border border-[#e5e2eb] bg-[#faf9fd] p-6">
            <h3 className="text-sm font-semibold text-[#2d2a3f]">Who might use this?</h3>
            <p className="mt-2 text-sm leading-7 text-[#686b79]">An early hypothesis is scientists and biotech diligence analysts preparing a source-backed research brief. We have not yet demonstrated that it saves them time compared with their existing tools.</p>
            <p className="mt-3 text-xs leading-6 text-[#80808b]">This is not a complete clinical intelligence product, a medical adviser, an investment recommendation or a way to buy experimental compounds.</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1080px] px-5 py-10 sm:px-8">
        <details id="previews" className="group scroll-mt-24 rounded-xl border border-[#e0dee8] bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-[#45425e] hover:bg-[#f8f7ff] [&::-webkit-details-marker]:hidden">
            Other limited source previews and the earlier four-trial comparison
            <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <div className="flex flex-wrap gap-4 border-t border-[#ececf0] px-5 py-5 text-sm font-semibold text-[#5748a7]">
            <Link href="/intelligence/cagrilintide/audit" className="hover:underline">Four-trial comparison <ArrowUpRight className="inline size-3" /></Link>
            <Link href="/intelligence/retatrutide" className="hover:underline">Retatrutide sample <ArrowUpRight className="inline size-3" /></Link>
            <Link href="/intelligence/tirzepatide" className="hover:underline">Tirzepatide sample <ArrowUpRight className="inline size-3" /></Link>
          </div>
        </details>
      </div>
    </main>
  );
}

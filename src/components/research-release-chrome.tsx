import Link from "next/link";
import { ArrowUpRight, BookOpenCheck, FlaskConical, ShieldAlert } from "lucide-react";
import { VialGradeMark } from "./wordmark";

/**
 * Small public shell for the evidence-only deployment. Unlike the retired
 * marketplace shell, this has no catalog, price search, follow buttons,
 * recommendations, saved-compound UI, or internal referral navigation.
 */
export function ResearchReleaseHeader() {
  return (
    <>
      <div className="border-b border-[#111214]/10 bg-[#f7f7f4] px-5 py-2 text-center text-[11px] font-medium leading-5 text-[#555]">
        Public trial research only · No purchases or medical recommendations.
      </div>
      <header className="sticky top-0 z-40 border-b-2 border-[#111214] bg-[rgba(247,247,244,.95)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[68px] max-w-[1320px] items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link href="/intelligence" className="inline-flex items-center gap-2.5" aria-label="VialGrade Research home">
            <VialGradeMark idPrefix="research-head" />
            <span className="text-[15px] font-black tracking-[0.12em]">VialGrade</span>
            <span className="hidden rounded-full border border-[#2b31d8]/20 bg-[#edeaff] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.1em] text-[#2b31d8] sm:inline-flex">Intelligence</span>
          </Link>
          <nav aria-label="Research navigation" className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
            <Link href="/intelligence" className="rounded-full bg-[#28234c] px-3 py-2 text-xs font-semibold text-white hover:bg-[#44368d] sm:px-4 sm:text-sm">Check a study</Link>
            <Link href="/intelligence/studies/NCT05804162" className="rounded-full px-2.5 py-2 text-xs font-semibold text-[#303247] hover:bg-[#eee] sm:px-3 sm:text-sm">Example</Link>
            <Link href="/intelligence#method" className="hidden rounded-full px-2.5 py-2 text-xs font-semibold text-[#303247] hover:bg-[#eee] md:inline-flex md:text-sm">How it works</Link>
            <Link href="/login" className="hidden rounded-full border border-[#111214]/20 px-3 py-2 text-xs font-bold hover:bg-[#eee] lg:inline-flex">Existing account</Link>
          </nav>
        </div>
      </header>
    </>
  );
}

export function ResearchReleaseFooter() {
  return (
    <footer className="border-t-2 border-[#111214] bg-[#111214] text-white">
      <div className="mx-auto grid max-w-[1120px] gap-10 px-5 py-12 sm:grid-cols-[1.4fr_1fr] sm:px-8 sm:py-16">
        <div>
          <div className="inline-flex items-center gap-3">
            <VialGradeMark idPrefix="research-foot" className="size-8" />
            <span className="text-sm font-extrabold tracking-[.16em]">VialGrade Intelligence</span>
          </div>
          <p className="mt-5 max-w-lg text-sm leading-7 text-white/60">
            A developing research tool for checking scientific sources and their limitations.
            The old peptide marketplace and vendor data are not available in this public release.
          </p>
          <p className="mt-4 max-w-lg text-xs leading-6 text-white/45">
            A research-use label is not a drug-law exemption. Trial listings and publication
            metadata do not establish product safety, clinical benefit or legal sale.
          </p>
        </div>
        <nav aria-label="Legal and source navigation" className="grid content-start gap-3 text-sm font-semibold text-white/75">
          <Link href="/intelligence/studies/NCT05804162" className="inline-flex items-center gap-2 hover:text-[#c0baff]"><BookOpenCheck className="size-4" /> Example study check</Link>
          <Link href="/intelligence#previews" className="hover:text-[#c0baff]">Other source samples</Link>
          <Link href="/intelligence#method" className="hover:text-[#c0baff]">Scope and limitations</Link>
          <Link href="/legal/us-regulations" className="inline-flex items-center gap-2 hover:text-[#8fffd6]"><ShieldAlert className="size-4" /> Regulatory overview</Link>
          <Link href="/legal/privacy" className="hover:text-[#8fffd6]">Privacy and data requests</Link>
          <Link href="/legal/disclaimer" className="hover:text-[#8fffd6]">Research limitations</Link>
          <Link href="/legal/contact" className="hover:text-[#8fffd6]">Contact and corrections</Link>
          <Link href="/login" className="hover:text-[#8fffd6]">Existing account access</Link>
          <a href="https://clinicaltrials.gov/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-[#8fffd6]"><FlaskConical className="size-4" /> ClinicalTrials.gov <ArrowUpRight className="size-3.5" /></a>
          <a href="https://openalex.org/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-[#8fffd6]">OpenAlex source metadata <ArrowUpRight className="size-3.5" /></a>
        </nav>
      </div>
      <div className="mx-auto max-w-[1120px] border-t border-white/15 px-5 py-6 text-xs text-white/45 sm:px-8">
        © 2026 VialGrade. Independent research records, not a pharmacy, laboratory, medical adviser or investment adviser.
      </div>
    </footer>
  );
}

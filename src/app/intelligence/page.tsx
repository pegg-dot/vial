import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, Building2, ClipboardCheck, FileSearch, NotebookPen, SearchCheck } from "lucide-react";
import { StudyLookupForm } from "@/components/intelligence/study-lookup-form";
import {
  OriginalResearchHero, OriginalResearchManifesto, OriginalResearchFeatures,
  OriginalResearchCategorySection, OriginalResearchBigNumber, OriginalResearchCompoundsShowcase,
  OriginalResearchFinalCta,
} from "@/components/intelligence/research-original-home";

export const metadata: Metadata = {
  title: "Follow the evidence | VialGrade",
  description: "Research compounds, studies and source records in one place. Verify precise identities and original research rather than trusting a summary.",
  alternates: { canonical: "/intelligence" },
};

const deeper = [
  { name: "Verify a source", note: "Inspect an original trial or publication", href: "/intelligence/verify?ref=PMID%2036781451", action: "Try source verifier", icon: SearchCheck },
  { name: "Research Desk", note: "Explore an exact question, sources and gaps", href: "/intelligence/desk", action: "Open Research Desk", icon: NotebookPen },
  { name: "Organizations & labs", note: "Follow sponsors and laboratory documents", href: "/intelligence/organizations", action: "Explore source organizations", icon: Building2 },
  { name: "Material records", note: "Check report-to-lot documents without a quality claim", href: "/intelligence/materials?subject=pexiganan", action: "Open material verification", icon: ClipboardCheck },
] as const;

export default async function IntelligencePage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  return (
    <div className="min-h-screen bg-[var(--background)] text-[#111214]">
      {notice === "retired" && (
        <div role="status" className="border-b-2 border-[#111214] bg-[#fff3d8] px-5 py-3 text-center text-xs font-semibold leading-6">
          The previous shopping marketplace is archived. Purchasing and seller referrals are not available; existing accounts can still access historical records.
        </div>
      )}
      <OriginalResearchHero />
      <OriginalResearchManifesto />
      <OriginalResearchFeatures />
      <OriginalResearchCategorySection />
      <OriginalResearchBigNumber />
      <OriginalResearchCompoundsShowcase />

      <section className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#2b31d8]">What a source trail actually looks like</p>
            <h2 className="mt-3 max-w-2xl text-balance text-[clamp(2.4rem,5.3vw,4rem)] font-extrabold leading-[.92] tracking-[-.045em]">A record you can <span className="text-[#2b31d8]">inspect for yourself.</span></h2>
            <p className="mt-4 max-w-xl text-sm font-medium leading-6 text-[var(--muted)]">Pexiganan is a designed analog related to Magainin 2. Its molecular identity, registered trial and original papers aren&apos;t the same evidence.</p>
          </div>
          <Link href="/intelligence/passports/pexiganan" className="ink hard-sm press inline-flex items-center gap-1 rounded-full bg-white px-5 py-3 text-sm font-bold">Open the evidence passport <ArrowRight className="size-4" /></Link>
        </div>
        <div className="mt-9 grid gap-5 md:grid-cols-3">
          <Link href="/intelligence/explore/pexiganan" className="ink hard press group flex flex-col rounded-[18px] bg-white p-6">
            <span className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[#2b31d8]">01 · Exact identity</span>
            <p className="mt-3 text-2xl font-extrabold tracking-[-.03em]">Pexiganan / MSI-78</p>
            <p className="mt-2 flex-1 text-sm font-medium leading-6 text-[var(--muted)]">A separate PubChem molecular record, not interchangeable with natural Magainin 2.</p>
            <span className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-[#2b31d8]">CID 16132253 · Open dossier <ArrowUpRight className="size-4" /></span>
          </Link>
          <Link href="/intelligence/studies/NCT01594762" className="ink hard press group flex flex-col rounded-[18px] bg-white p-6">
            <span className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[#0e8f80]">02 · Registered study</span>
            <p className="mt-3 text-2xl font-extrabold tracking-[-.03em]">NCT01594762</p>
            <p className="mt-2 flex-1 text-sm font-medium leading-6 text-[var(--muted)]">Original ClinicalTrials.gov registration. An intervention name is not a demonstrated clinical result.</p>
            <span className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-[#2b31d8]">View official registry context <ArrowUpRight className="size-4" /></span>
          </Link>
          <Link href="/intelligence/cases/magainin-pexiganan" className="ink hard press group flex flex-col rounded-[18px] bg-white p-6">
            <span className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[#d04d5d]">03 · What doesn&apos;t match</span>
            <p className="mt-3 text-2xl font-extrabold tracking-[-.03em]">A related molecule isn&apos;t identical.</p>
            <p className="mt-2 flex-1 text-sm font-medium leading-6 text-[var(--muted)]">Inspect why experimental observations about an original peptide shouldn&apos;t automatically transfer to a designed analog.</p>
            <span className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-[#2b31d8]">Read the source lineage <ArrowUpRight className="size-4" /></span>
          </Link>
        </div>
        <nav aria-label="Follow Pexiganan evidence" className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-extrabold text-[#2b31d8]">
          <Link href="/intelligence/explore/pexiganan" className="inline-flex items-center gap-1 hover:underline">Open the dossier <ArrowUpRight className="size-4" /></Link>
          <Link href="/intelligence/verify" className="inline-flex items-center gap-1 hover:underline">Verify source <ArrowUpRight className="size-4" /></Link>
          <Link href="/intelligence/cases/magainin-pexiganan" className="inline-flex items-center gap-1 hover:underline">Open guided example <ArrowUpRight className="size-4" /></Link>
        </nav>
        <Link href="/intelligence/market#browse" className="mt-8 inline-flex items-center gap-1 text-sm font-extrabold text-[#2b31d8] underline underline-offset-4">Browse all 16 research records <ArrowRight className="size-4" /></Link>
      </section>

      <section className="border-y-2 border-[#111214] bg-white">
        <div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 sm:py-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Beyond the compound card</p>
              <h2 className="mt-3 text-[clamp(2.4rem,5vw,3.7rem)] font-extrabold leading-[.95] tracking-[-.045em]">Go deeper.</h2>
              <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-[var(--muted)]">Start with the compound, then follow the underlying experiments, reports, and organizations.</p>
            </div>
            <Link href="/intelligence/grading" className="text-sm font-bold text-[#2b31d8] underline underline-offset-4">How source coverage works</Link>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {deeper.map(({ name, note, href, action, icon: Icon }, index) => (
              <Link key={href} href={href} aria-label={action}
                className="ink hard press group flex min-h-55 flex-col rounded-[18px] bg-white p-6">
                <div className={"ink-1 grid size-14 place-items-center rounded-xl " + (index % 2 ? "bg-[#e6fbf6]" : "bg-[#eef0ff]")}>
                  <Icon className="size-7 text-[#2b31d8]" />
                </div>
                <h3 className="mt-5 text-xl font-extrabold tracking-[-.035em]">{name}</h3>
                <p className="mt-2 flex-1 text-sm font-medium leading-6 text-[var(--muted)]">{note}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#2b31d8]">Open <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span>
              </Link>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold text-[#2b31d8]">
            <Link href="/intelligence/explore/pexiganan" aria-label="Open Pexiganan dossier" className="inline-flex items-center gap-1 hover:underline">Pexiganan dossier <ArrowUpRight className="size-4" /></Link>
            <Link href="/intelligence/passports/pexiganan" aria-label="See evidence passport" className="inline-flex items-center gap-1 hover:underline">Evidence passport <ArrowUpRight className="size-4" /></Link>
            <Link href="/intelligence/providers" className="inline-flex items-center gap-1 hover:underline">Public supplier documentation <ArrowUpRight className="size-4" /></Link>
            <Link href="/intelligence/compare?subjects=magainin-2%2Cpexiganan" aria-label="Compare Magainin 2 and Pexiganan" className="inline-flex items-center gap-1 hover:underline">Compare Magainin 2 and Pexiganan <ArrowUpRight className="size-4" /></Link>
          </div>
        </div>
      </section>

      <section id="trial-lookup" className="scroll-mt-36">
        <div className="mx-auto grid max-w-[1320px] gap-7 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
          <div>
            <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#2b31d8]"><FileSearch className="size-4" /> A source worth checking</p>
            <h2 className="mt-4 text-[clamp(2.5rem,5vw,3.9rem)] font-extrabold leading-[.95] tracking-[-.045em]">Already have <span className="text-[#2b31d8]">a trial ID?</span></h2>
            <p className="mt-4 max-w-lg text-sm font-medium leading-7 text-[var(--muted)]">Enter an NCT number and inspect the registered study separately from any published report. A linked article alone does not prove an outcome.</p>
            <Link href="/intelligence/studies/NCT05804162" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#2b31d8] hover:underline">View a real trial example <ArrowUpRight className="size-4" /></Link>
          </div>
          <div className="ink hard rounded-[20px] bg-white p-5 sm:p-7"><StudyLookupForm /></div>
        </div>
      </section>
      <OriginalResearchFinalCta />
      <section id="method" className="mx-auto max-w-[1320px] scroll-mt-36 border-t border-[#111214]/20 px-5 py-8 text-xs font-medium leading-6 text-[#666970] sm:px-8">
        <p><strong className="text-[#111214]">About this library.</strong> The selected public references are not a systematic literature review. File coverage is not biological effectiveness, material purity or legal authorization to sell. No purchasing, clinical advice or laboratory certification.</p>
        <Link href="/intelligence/grading" className="mt-3 inline-flex items-center gap-1 font-bold text-[#2b31d8] hover:underline">Read the file-checking method <BookOpen className="size-4" /></Link>
      </section>
    </div>
  );
}

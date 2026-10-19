import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, Building2, ClipboardCheck, FileSearch, NotebookPen, SearchCheck } from "lucide-react";
import { ResearchExplorer } from "@/components/intelligence/research-explorer";
import { StudyLookupForm } from "@/components/intelligence/study-lookup-form";

export const metadata: Metadata = {
  title: "Explore peptide research | VialGrade",
  description: "Browse peptide research records, inspect original source links, compare compounds and check what is documented.",
  alternates: { canonical: "/intelligence" },
};

const researchTools = [
  {
    name: "Check a source",
    note: "Look up an original trial or publication record",
    href: "/intelligence/verify?ref=PMID%2036781451",
    action: "Try source verifier",
    icon: SearchCheck,
  },
  {
    name: "Research Desk",
    note: "Investigate a question with source-linked evidence notes",
    href: "/intelligence/desk",
    action: "Open Research Desk",
    icon: NotebookPen,
  },
  {
    name: "Organizations & labs",
    note: "Follow trial sponsors and public laboratory documentation",
    href: "/intelligence/organizations",
    action: "Explore source organizations",
    icon: Building2,
  },
  {
    name: "Material records",
    note: "Review lot-to-report checks without claiming lab certification",
    href: "/intelligence/materials?subject=pexiganan",
    action: "Open material verification",
    icon: ClipboardCheck,
  },
] as const;

export default async function IntelligencePage({ searchParams }: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  return (
    <main className="min-h-screen bg-[#f7f8f6] pb-16">
      {notice === "retired" && (
        <div role="status" className="border-b border-[#e7dbc5] bg-[#fcf7eb] px-5 py-3 text-center text-xs leading-6 text-[#775d35]">
          The previous shopping marketplace is archived. Purchasing and seller referrals are not available; existing accounts can still view historical records.
        </div>
      )}

      <section className="border-b border-[#e0e5e1] bg-white">
        <div className="mx-auto max-w-[1200px] px-5 pb-5 pt-6 sm:px-8 sm:pb-9 sm:pt-12">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-2xl">
              <p className="hidden text-xs font-semibold text-[#41705e] sm:block">Research library</p>
              <h1 className="mt-2 text-[clamp(2.2rem,4.5vw,3.6rem)] font-bold leading-[1.08] tracking-[-.055em] text-[#1b2620]">
                Explore peptides
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-[#526359] sm:text-base">
                Browse compounds, studies and original sources in one place. Open a record to see what has actually been checked.
              </p>
            </div>
            <div className="hidden items-center gap-5 border-t border-[#e4e9e5] pt-3 sm:flex sm:border-0 sm:pt-0">
              <div><p className="text-xl font-bold tabular-nums text-[#1f3529]">16</p><p className="text-xs text-[#66776d]">Compounds</p></div>
              <div className="h-9 w-px bg-[#e0e5e1]" aria-hidden="true" />
              <div><p className="text-xl font-bold tabular-nums text-[#1f3529]">4</p><p className="text-xs text-[#66776d]">Research areas</p></div>
              <div className="h-9 w-px bg-[#e0e5e1]" aria-hidden="true" />
              <div><p className="text-xl font-bold tabular-nums text-[#1f3529]">5</p><p className="text-xs text-[#66776d]">Trial examples</p></div>
            </div>
          </div>
        </div>
      </section>

      <div id="explore" className="mx-auto max-w-[1200px] scroll-mt-24 px-5 pb-12 pt-5 sm:px-8 sm:pt-10">
        <ResearchExplorer />
      </div>

      <section id="research-tools" aria-labelledby="research-tools-heading" className="border-y border-[#e0e5e1] bg-white">
        <div className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8 sm:py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="research-tools-heading" className="text-2xl font-bold tracking-[-.045em] text-[#1c2921]">Go deeper</h2>
              <p className="mt-1 text-sm leading-6 text-[#67766d]">These tools help when you need to check a specific claim or research record.</p>
            </div>
            <Link href="/intelligence/grading" className="text-xs font-semibold text-[#2b6a50] underline underline-offset-4">How file checks work</Link>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {researchTools.map(({ name, note, href, action, icon: Icon }) => (
              <Link key={href} href={href} aria-label={action}
                className="group flex min-h-36 flex-col rounded-xl border border-[#dce5dd] bg-[#fcfdfb] px-4 py-5 hover:border-[#82b09a] hover:shadow-[0_5px_16px_rgba(35,59,40,.06)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#27765a]">
                <Icon aria-hidden="true" className="size-5 text-[#357356]" />
                <h3 className="mt-3 text-sm font-bold text-[#273b2e]">{name}</h3>
                <p className="mt-1 flex-1 text-xs leading-5 text-[#6a786f]">{note}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#2c7156]">Open <ArrowRight aria-hidden="true" className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span>
              </Link>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-[#356f55]">
            <Link href="/intelligence/explore/pexiganan" className="inline-flex items-center gap-1 hover:underline" aria-label="Open Pexiganan dossier">Pexiganan dossier <ArrowUpRight className="size-3.5" /></Link>
            <Link href="/intelligence/passports/pexiganan" className="inline-flex items-center gap-1 hover:underline" aria-label="See evidence passport">Evidence passport <ArrowUpRight className="size-3.5" /></Link>
            <Link href="/intelligence/providers" className="inline-flex items-center gap-1 hover:underline">Public supplier documentation <ArrowUpRight className="size-3.5" /></Link>
            <Link href="/intelligence/compare?subjects=magainin-2%2Cpexiganan" className="inline-flex items-center gap-1 hover:underline" aria-label="Compare Magainin 2 and Pexiganan">Compare Magainin 2 and Pexiganan <ArrowUpRight className="size-3.5" /></Link>
          </div>
        </div>
      </section>

      <section id="trial-lookup" className="scroll-mt-24">
        <div className="mx-auto grid max-w-[1200px] gap-6 px-5 py-11 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#397257]"><FileSearch className="size-4" /> Source lookup</div>
            <h2 className="mt-2 text-2xl font-bold tracking-[-.045em] text-[#253429]">Already have a trial ID?</h2>
            <p className="mt-2 max-w-lg text-sm leading-7 text-[#66776b]">Enter an NCT number to inspect its registered status and linked publication records. A linked paper doesn&apos;t automatically prove a trial&apos;s outcome.</p>
            <Link href="/intelligence/studies/NCT05804162" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#2b7054] hover:underline">View a trial example <ArrowUpRight className="size-3.5" /></Link>
          </div>
          <div className="rounded-xl border border-[#dbe4dd] bg-white p-5 sm:p-6"><StudyLookupForm /></div>
        </div>
      </section>

      <section id="method" className="mx-auto max-w-[1200px] border-t border-[#e0e6e0] px-5 pt-6 text-xs leading-6 text-[#6a756d] sm:px-8">
        <p><strong>About this library.</strong> VialGrade links selected public research records, not a complete systematic review. File grades describe documented source coverage, not peptide effectiveness or material quality. No purchase, clinical advice, or supplier certification is offered.</p>
        <Link href="/intelligence/grading" className="mt-2 inline-flex items-center gap-1 font-semibold text-[#286e52] hover:underline">Read the file-checking method <BookOpen className="size-3.5" /></Link>
      </section>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpenCheck, CheckCircle2, CircleHelp, FileSearch, FlaskConical, GitCompareArrows, LockKeyhole, SearchCheck, ShieldAlert } from "lucide-react";

export const metadata: Metadata = {
  title: "VialGrade Intelligence | Source-checked research",
  description: "Investigate selected clinical research programs by checking actual study designs, official source records, results availability, and unresolved questions.",
  alternates: { canonical: "/intelligence" },
};

const topicCards = [
  {
    key: "cagrilintide",
    label: "Cagrilintide",
    tag: "Working study audit",
    lead: "See how four official trial records differ in design, named interventions, primary outcomes and results reporting.",
    action: "Open source dossier",
  },
  {
    key: "retatrutide",
    label: "Retatrutide",
    tag: "Source-discovery preview",
    lead: "Inspect a limited sample of registered studies and publication metadata. A guided study audit is not ready for this topic.",
    action: "Browse source sample",
  },
  {
    key: "tirzepatide",
    label: "Tirzepatide",
    tag: "Source-discovery preview",
    lead: "Follow primary registry identifiers and scholarly metadata while we test fuller research workflows.",
    action: "Browse source sample",
  },
] as const;

export default async function IntelligencePage({
  searchParams,
}: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;

  return (
    <div>
      {notice === "retired" && (
        <section role="status" className="border-b border-[#a76512]/25 bg-[#fff7e9]">
          <div className="mx-auto flex max-w-[1120px] flex-col gap-2 px-5 py-4 text-sm sm:px-8">
            <strong className="text-[#6e4315]">That page belongs to the retired marketplace.</strong>
            <p className="leading-6 text-[#70512c]">
              Buying, seller listings, checkout and referral links are disabled. The old code remains archived,
              but this public site only offers research evidence and existing account remedies.
              Start with the study audit below or browse one of the available research topics.
            </p>
          </div>
        </section>
      )}

      <section className="border-b-2 border-[#111214] bg-[#f7f7f4]">
        <div className="mx-auto grid max-w-[1120px] gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.12fr_.88fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.14em] text-[#2b31d8]">
              <BookOpenCheck className="size-4" /> VialGrade Intelligence · Research preview
            </p>
            <h1 className="mt-6 max-w-[680px] text-balance text-[clamp(2.8rem,5.5vw,5.1rem)] font-extrabold leading-[1.03] tracking-[-.06em]">
              Understand the study. Not just the search result.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-[#111214]/75 sm:text-lg">
              ClinicalTrials.gov already has the records. Google Scholar already has more papers.
              We are testing a different job: bringing the relevant source details together so
              you can check what was studied, what is reported, and what remains unresolved.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/intelligence/cagrilintide/audit"
                className="inline-flex items-center gap-2 rounded-full bg-[#111214] px-5 py-3 text-sm font-extrabold text-white hover:bg-[#303039]">
                Try a study audit <ArrowUpRight className="size-4" />
              </Link>
              <Link href="#workspace" className="inline-flex items-center gap-2 rounded-full border border-[#111214]/25 bg-white px-5 py-3 text-sm font-bold hover:bg-[#eee]">
                Explore research topics <ArrowRight className="size-4" />
              </Link>
            </div>
            <p className="mt-5 text-xs leading-6 text-[#666]">No account needed. No buying or seller recommendations. No AI clinical verdicts.</p>
          </div>

          <div className="overflow-hidden rounded-[20px] border-2 border-[#111214] bg-white">
            <div className="border-b border-[#111214]/10 bg-[#e9e7ff] px-6 py-4">
              <p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#2b31d8]">The first working research task</p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-[-.04em]">Audit cagrilintide studies</h2>
              <p className="mt-2 text-sm leading-6 text-[#111214]/70">Four hand-selected official records, with links back to each original source.</p>
            </div>
            <div className="space-y-0 px-6">
              <div className="flex gap-3 border-b border-[#111214]/10 py-5">
                <SearchCheck className="mt-0.5 size-5 shrink-0 text-[#2b31d8]" />
                <div><p className="text-sm font-extrabold">Check the right research entity</p>
                  <p className="mt-1 text-xs leading-6 text-[var(--muted)]">Separate molecule development codes from a combination-product name.</p>
                </div>
              </div>
              <div className="flex gap-3 border-b border-[#111214]/10 py-5">
                <FlaskConical className="mt-0.5 size-5 shrink-0 text-[#2b31d8]" />
                <div><p className="text-sm font-extrabold">Understand the actual study design</p>
                  <p className="mt-1 text-xs leading-6 text-[var(--muted)]">See registered interventions, outcomes, populations and trial timing.</p>
                </div>
              </div>
              <div className="flex gap-3 py-5">
                <CircleHelp className="mt-0.5 size-5 shrink-0 text-[#2b31d8]" />
                <div><p className="text-sm font-extrabold">Know what is still missing</p>
                  <p className="mt-1 text-xs leading-6 text-[var(--muted)]">Distinguish results availability and unresolved questions from proven findings.</p>
                </div>
              </div>
            </div>
            <Link href="/intelligence/cagrilintide/audit" className="flex items-center justify-between border-t border-[#111214]/10 bg-[#f7f7f4] px-6 py-4 text-sm font-extrabold text-[#2b31d8] hover:bg-[#eeecff]">
              Review the four-study audit <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <section id="workspace" className="mx-auto max-w-[1120px] scroll-mt-24 px-5 py-14 sm:px-8 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#2b31d8]">Research areas</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-[-.045em] sm:text-4xl">Choose what you need to investigate.</h2>
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
            One guided audit is available for testing. The other two areas currently offer only small,
            unsystematic search samples from ClinicalTrials.gov and OpenAlex. We label that difference clearly.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {topicCards.map((topic) => (
            <article key={topic.key} className="flex flex-col rounded-[18px] border border-[#111214]/20 bg-white p-6">
              <span className="w-fit rounded-full bg-[#f1f0fb] px-3 py-1 text-[11px] font-bold text-[#2b31d8]">{topic.tag}</span>
              <h3 className="mt-5 text-2xl font-extrabold tracking-[-.04em]">{topic.label}</h3>
              <p className="mt-3 min-h-24 text-sm leading-7 text-[var(--muted)]">{topic.lead}</p>
              {topic.key === "cagrilintide" && (
                <Link href="/intelligence/cagrilintide/audit"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-extrabold text-[#2b31d8] underline-offset-4 hover:underline">
                  Run the study audit <ArrowUpRight className="size-4" />
                </Link>
              )}
              <Link href={"/intelligence/" + topic.key}
                className="mt-auto flex items-center justify-between gap-2 border-t border-[#111214]/10 pt-5 text-sm font-bold text-[#111214] hover:text-[#2b31d8]">
                {topic.action} <ArrowRight className="size-4" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section id="method" className="scroll-mt-24 border-y border-[#111214]/10 bg-white">
        <div className="mx-auto max-w-[1120px] px-5 py-14 sm:px-8 sm:py-20">
          <div className="flex max-w-3xl items-start gap-3">
            <GitCompareArrows className="mt-1 size-6 shrink-0 text-[#2b31d8]" />
            <div>
              <h2 className="text-3xl font-extrabold tracking-[-.045em]">What VialGrade adds, and what it does not</h2>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                The goal is an auditable research workflow, not to compete with Google Scholar on index size.
                The current prototype makes source identity, trial design and uncertainties easier to inspect.
                It does not independently verify every clinical claim or track all relevant sources.
              </p>
            </div>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-[14px] border border-[#111214]/15 bg-[#f7f7f4] p-5">
              <CheckCircle2 className="size-5 text-[#2b31d8]" />
              <h3 className="mt-4 text-base font-extrabold">Original records first</h3>
              <p className="mt-2 text-xs leading-6 text-[var(--muted)]">Each selected study links to its NCT identifier and registered intervention and outcome details.</p>
            </div>
            <div className="rounded-[14px] border border-[#111214]/15 bg-[#f7f7f4] p-5">
              <FileSearch className="size-5 text-[#2b31d8]" />
              <h3 className="mt-4 text-base font-extrabold">Open questions stay visible</h3>
              <p className="mt-2 text-xs leading-6 text-[var(--muted)]">No posted registry results, a different study outcome or a combination label remains a review question, not a verdict.</p>
            </div>
            <div className="rounded-[14px] border border-[#111214]/15 bg-[#f7f7f4] p-5">
              <LockKeyhole className="size-5 text-[#2b31d8]" />
              <h3 className="mt-4 text-base font-extrabold">No commerce</h3>
              <p className="mt-2 text-xs leading-6 text-[var(--muted)]">Vendor listings, purchases, checkout and affiliate referrals are not active. Historical marketplace software is archived separately.</p>
            </div>
          </div>
          <div className="mt-7 flex flex-wrap gap-4 text-sm font-bold text-[#2b31d8]">
            <Link href="/legal/disclaimer" className="inline-flex items-center gap-2 underline">Research limitations <ArrowUpRight className="size-4" /></Link>
            <Link href="/legal/us-regulations" className="inline-flex items-center gap-2 underline">Regulatory context <ArrowUpRight className="size-4" /></Link>
            <Link href="/legal/contact" className="inline-flex items-center gap-2 underline">Corrections and source concerns <ArrowUpRight className="size-4" /></Link>
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-[1120px] flex-col gap-4 px-5 py-9 sm:px-8">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-[#a76512]" />
          <p className="max-w-4xl text-xs leading-6 text-[var(--muted)]">
            Current study audits are examples, not systematic reviews or clinical outcome conclusions.
            Registry status and source dates must not be interpreted as treatment effectiveness, regulatory approval,
            securities advice or permission to sell a compound. Historical versions are not yet compared;
            no claim about historical changes is made without two verified source snapshots.
          </p>
        </div>
      </section>
    </div>
  );
}

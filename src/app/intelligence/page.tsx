import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BookOpen, ChartNoAxesCombined, FileCheck2, Network, Radar, Scale } from "lucide-react";

export const metadata: Metadata = {
  title: "Research intelligence",
  description: "A proposed evidence-first research intelligence workspace for peptide R&D: trace sources, trials, regulatory changes and the limits of laboratory documentation.",
  alternates: { canonical: "/intelligence" },
};

const areas = [
  {
    icon: BookOpen, title: "Scientific evidence",
    body: "Separate preclinical findings from human trials. Record study design, endpoints, dates, limits and contradictions with a link back to the original source.",
  },
  {
    icon: Radar, title: "Development and regulatory signals",
    body: "Map public trial status, development milestones and agency actions over time. Never confuse a pipeline milestone with authorization or clinical benefit.",
  },
  {
    icon: Network, title: "Document and sample provenance",
    body: "Link laboratory reports to their issuer and described sample. Show gaps in the chain of custody instead of translating a purity number into a product endorsement.",
  },
  {
    icon: ChartNoAxesCombined, title: "An analyst's research trail",
    body: "Track where two credible sources disagree, what changed since the last review and which conclusions still need human expert assessment.",
  },
];
const sources = [
  { label: "ClinicalTrials.gov", purpose: "Trial records and development status", url: "https://clinicaltrials.gov/" },
  { label: "PubMed", purpose: "Published biomedical research", url: "https://pubmed.ncbi.nlm.nih.gov/" },
  { label: "FDA / openFDA", purpose: "U.S. regulatory actions and public FDA datasets", url: "https://open.fda.gov/" },
  { label: "OpenAlex", purpose: "Scholarly metadata and linked publications", url: "https://openalex.org/" },
];

export default function IntelligencePage() {
  return (
    <div>
      <section className="border-b-2 border-[#111214] bg-[#f0edff]">
        <div className="mx-auto max-w-[1100px] px-5 py-16 sm:px-8 sm:py-24">
          <span className="ink-1 inline-flex rounded-full bg-white px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[.15em] text-[#2b31d8]">
            Product direction · preview, not a launched research terminal
          </span>
          <h1 className="mt-8 max-w-[900px] text-balance text-[clamp(2.9rem,6.5vw,5.8rem)] font-extrabold leading-[.98] tracking-[-.06em]">
            The evidence behind peptide research, in one place.
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-8 text-[#111214]/75 sm:text-lg">
            VialGrade is exploring a research intelligence workspace for scientists,
            biotech analysts and investors who want to inspect the original evidence,
            not another untraceable AI answer or peptide-shopping directory.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/compounds" className="ink hard-sm press inline-flex items-center gap-2 rounded-full bg-[#111214] px-6 py-3 text-sm font-bold text-white">
              Browse current compound records <ArrowUpRight className="size-4" />
            </Link>
            <Link href="/how-we-check" className="ink hard-sm press inline-flex items-center rounded-full bg-white px-6 py-3 text-sm font-bold text-[#111214]">
              How the current evidence checks work
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-5 py-16 sm:px-8 sm:py-20">
        <p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#2b31d8]">What a research terminal should answer</p>
        <h2 className="mt-3 max-w-3xl text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">Find the source. See what's missing. Understand what changed.</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {areas.map(({ icon: Icon, title, body }) => (
            <article key={title} className="ink hard-sm rounded-[18px] bg-white p-6">
              <span className="ink-1 inline-flex size-10 items-center justify-center rounded-xl bg-[#f0edff]"><Icon className="size-5 text-[#2b31d8]" /></span>
              <h3 className="mt-5 text-lg font-extrabold tracking-[-.025em]">{title}</h3>
              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{body}</p>
            </article>
          ))}
        </div>
        <p className="mt-5 text-[13px] leading-6 text-[var(--muted)]">
          These are proposed workflows, not a claim that VialGrade already operates a complete
          clinical, patent or financing database. AI-generated research summaries are not
          published as verified findings without source links and review.
        </p>
      </section>

      <section className="border-t-2 border-[#111214] bg-white">
        <div className="mx-auto max-w-[1100px] px-5 py-16 sm:px-8 sm:py-20">
          <div className="flex items-center gap-2"><FileCheck2 className="size-5 text-[#2b31d8]" /><p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#2b31d8]">Source-first development</p></div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-[-.04em]">Primary records before AI conclusions.</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            A future AI research assistant should identify the question, retrieve permitted
            evidence, extract claim-level citations, reconcile conflicting reports and say
            when no answer is supported. These source systems illustrate where that work
            could begin. Their availability does not automatically authorize wholesale
            copying of articles, protected source documents or restricted datasets.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {sources.map((s) => (
              <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" className="ink-1 flex items-center justify-between gap-4 rounded-[14px] p-4 hover:bg-[#f7f7f4]">
                <span><span className="block font-extrabold">{s.label}</span><span className="mt-1 block text-xs text-[var(--muted)]">{s.purpose}</span></span>
                <ArrowUpRight className="size-4 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-5 py-14 sm:px-8">
        <div className="flex items-start gap-3 rounded-[18px] border border-[#111214]/15 bg-[#fff9ed] p-6">
          <Scale className="mt-0.5 size-5 shrink-0 text-[#b26a00]" aria-hidden="true" />
          <div>
            <h2 className="font-extrabold">Research isn't regulatory permission.</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">This platform does not offer medication, dosing, peptide purchases or seller checkout links. A “research use only” label does not decide whether a product is an unapproved drug, and a cited laboratory report does not establish a future vial's identity or safety. Read the <Link href="/legal/us-regulations" className="font-bold text-[#2b31d8] underline underline-offset-2">U.S. regulatory overview</Link> and <Link href="/legal/privacy" className="font-bold text-[#2b31d8] underline underline-offset-2">privacy notice</Link>.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

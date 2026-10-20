import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpenCheck, ClipboardCheck, FlaskConical, ShieldAlert } from "lucide-react";
import { ResearchFileGradeCard } from "@/components/intelligence/research-file-grade";
import { FILE_GRADE_CURATION_DATE, FILE_GRADE_LIMITS, FILE_GRADE_METHOD_VERSION } from "@/lib/research-file-grade";
import { RESEARCH_SUBJECTS } from "@/lib/research-explorer";

export const metadata: Metadata = {
  title: "Research file grading method | VialGrade",
  description: "See the source checks behind provisional VialGrade research file grades, missing sources and cases where grades are withheld.",
  robots: { index: false, follow: false },
};

export default function ResearchFileGradingMethodPage() {
  const examples = ["pexiganan", "cagrilintide", "magainin-2", "retatrutide"]
    .map(slug => RESEARCH_SUBJECTS.find(subject => subject.slug === slug)!);
  const criteria = [
    { icon: BookOpenCheck, name: "Molecular reference", description: "A specific public compound identity source. A substance SID or unresolved variant requires explicit qualification and prevents a letter." },
    { icon: ClipboardCheck, name: "Named registry intervention", description: "One selected ClinicalTrials.gov study previously checked for the exact named intervention. This does not cover all clinical studies or their outcomes." },
    { icon: FlaskConical, name: "Original experiment", description: "One specific primary article individually inspected for the named molecule and experimental model, not just a search hit or a review." },
  ];

  return (
    <div className="bg-[#faf9f7] pb-20">
      <div className="mx-auto max-w-[1100px] px-5 pt-9 sm:px-8">
        <Link href="/intelligence/market#browse" className="inline-flex items-center gap-2 text-xs font-bold text-[#2a7065] hover:underline">
          <ArrowLeft className="size-4" /> Back to research market
        </Link>

        <header className="mt-8 rounded-[24px] border-2 border-[#17191b] bg-[#eafff6] px-6 py-9 sm:px-11 sm:py-12">
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#167d6e]">VialGrade · Research file scoring</p>
          <h1 className="mt-4 max-w-[850px] text-[clamp(2.1rem,4.7vw,3.6rem)] font-extrabold leading-[1.08] tracking-[-.06em] text-[#17191b]">
            What have we actually checked?
          </h1>
          <p className="mt-5 max-w-[800px] text-sm leading-7 text-[#406157] sm:text-base">
            The letter grades the completeness of a VialGrade starter FILE. Not the peptide itself. It cannot tell you whether a molecule is promising, safe, effective, or worth obtaining.
          </p>
          <p className="mt-3 text-xs font-bold text-[#67867c]">
            Method {FILE_GRADE_METHOD_VERSION} · Audited source list dated {FILE_GRADE_CURATION_DATE}
          </p>
        </header>

        <section aria-labelledby="source-method-heading" className="mt-9">
          <h2 id="source-method-heading" className="text-2xl font-extrabold tracking-[-.04em]">Three visible source checks</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {criteria.map(({ icon: Icon, name, description }) => (
              <article key={name} className="rounded-xl border border-[#dfe2e4] bg-white p-5">
                <Icon className="size-5 text-[#1a8879]" />
                <h3 className="mt-3 text-base font-extrabold">{name}</h3>
                <p className="mt-2 text-sm leading-6 text-[#626b72]">{description}</p>
              </article>
            ))}
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-4">
            {([
              ["A", "3 linked layers"], ["B", "2 linked layers"],
              ["C", "1 linked layer"], ["—", "Exact identity unresolved"],
            ] as const).map(([letter, note]) => (
              <div key={letter} className="flex items-center gap-3 rounded-xl border border-[#e2e5e5] bg-white p-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-md bg-[#17191b] text-lg font-black text-white">{letter}</span>
                <span className="text-xs font-bold text-[#4f5a60]">{note}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-[#7e6a55]">
            An A here is not scientifically stronger than a C. We only count the kinds of original sources individually anchored in this starter file. No selected trial or paper means not reviewed here, not that no such source exists.
          </p>
        </section>

        <section aria-labelledby="file-examples-heading" className="mt-10">
          <h2 id="file-examples-heading" className="text-2xl font-extrabold tracking-[-.04em]">Four examples with the checks exposed</h2>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {examples.map(subject => (
              <div key={subject.slug}>
                <Link href={"/intelligence/explore/" + subject.slug} className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-[#327668] hover:underline">
                  {subject.name} dossier <ArrowRight className="size-4" />
                </Link>
                <ResearchFileGradeCard subject={subject} compact />
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-2xl border-2 border-[#17191b] bg-white p-6 sm:p-8">
          <div className="flex items-center gap-2"><ShieldAlert className="size-5 text-[#9a6f45]" /><h2 className="text-lg font-extrabold">Why this is not a scientific certainty grade</h2></div>
          <p className="mt-3 text-sm leading-7 text-[#626b71]">{FILE_GRADE_LIMITS}</p>
          <p className="mt-3 text-sm leading-7 text-[#626b71]">
            A formal assessment of the certainty of evidence about a specific outcome requires appraisal of study bias, consistency, relevance, precision, and publication bias. We have not performed that expert assessment for these subjects.
          </p>
          <p className="mt-4 text-xs leading-6 text-[#7b8489]">
            Background: <a href="https://training.cochrane.org/handbook/current/chapter-14" target="_blank" rel="noopener noreferrer" className="underline">Cochrane certainty-of-evidence method</a> · <a href="https://ncats.nih.gov/about/about-translational-science/spectrum" target="_blank" rel="noopener noreferrer" className="underline">NIH translational research stages</a>.
          </p>
        </section>
      </div>
    </div>
  );
}

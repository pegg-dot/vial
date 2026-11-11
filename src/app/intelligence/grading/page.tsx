import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, ClipboardCheck, FlaskConical, ShieldCheck } from "lucide-react";
import { ResearchFileGradeCard } from "@/components/intelligence/research-file-grade";
import { IconTile, Notice, NumberedSection, PageFootnote, PageHero, Pill, Quiet, Section, UI } from "@/components/intelligence/research-ui";
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
  const scale = [
    ["A", "3 linked layers"], ["B", "2 linked layers"],
    ["C", "1 linked layer"], ["—", "Exact identity unresolved"],
  ] as const;

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      <PageHero art={["shield", "coa"]}
        breadcrumb={[{ href: "/intelligence/market", label: "Research Market" }, { label: "How we check" }]}
        eyebrow={<><ShieldCheck className="size-4" aria-hidden="true" /> VialGrade · Research file scoring</>}
        title="What have we actually checked?"
        lead="The letter grades the completeness of a VialGrade starter FILE. Not the peptide itself. It cannot tell you whether a molecule is promising, safe, effective, or worth obtaining."
        note={"Method " + FILE_GRADE_METHOD_VERSION + " · Audited source list dated " + FILE_GRADE_CURATION_DATE + " · file coverage is not a quality claim."}
        actions={<>
          <Pill href="#grade-examples" variant="primary" arrow="right">{"See the " + examples.length + " worked examples"}</Pill>
        </>}
      />

      <Section tight>
        <div className="grid gap-4">
          <NumberedSection id="grade-checks" number={1} eyebrow="Source checks" title="Three visible source checks"
            intro="A letter counts how many of these three kinds of original source are individually anchored in the file.">
            <div className="grid gap-3 md:grid-cols-3">
              {criteria.map(({ icon, name, description }) => (
                <Quiet key={name}>
                  <IconTile icon={icon} size="sm" />
                  <h3 className={UI.h4 + " mt-3"}>{name}</h3>
                  <p className={UI.small + " mt-1.5"}>{description}</p>
                </Quiet>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              {scale.map(([letter, note]) => (
                <div key={letter} className="ink-1 flex items-center gap-3 rounded-[14px] bg-white p-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-[#111214] text-lg font-black text-white">{letter}</span>
                  <span className="text-xs font-bold text-[#3a3d46]">{note}</span>
                </div>
              ))}
            </div>
            <Notice tone="warn">
              <p>An A here is not scientifically stronger than a C. We only count the kinds of original sources individually anchored in this starter file. No selected trial or paper means not reviewed here, not that no such source exists.</p>
            </Notice>
          </NumberedSection>

          <NumberedSection id="grade-examples" number={2} eyebrow="Examples" title="Four examples with the checks exposed"
            intro="The same card every dossier shows, with each check and its original link visible.">
            <div className="grid gap-4 lg:grid-cols-2">
              {examples.map(subject => (
                <div key={subject.slug} className="min-w-0">
                  <Link href={"/compounds/" + subject.slug} className={UI.link + " mb-3"}>
                    {subject.name} dossier <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                  <ResearchFileGradeCard subject={subject} compact />
                </div>
              ))}
            </div>
          </NumberedSection>

          <NumberedSection id="grade-limits" number={3} eyebrow="Limits" title="Why this is not a scientific certainty grade">
            <Notice tone="warn"><p>{FILE_GRADE_LIMITS}</p></Notice>
            <p className={UI.bodyInk + " leading-7"}>
              A formal assessment of the certainty of evidence about a specific outcome requires appraisal of study bias, consistency, relevance, precision, and publication bias. We have not performed that expert assessment for these subjects.
            </p>
            <p className={UI.small}>
              Background: <a href="https://training.cochrane.org/handbook/current/chapter-14" target="_blank" rel="noopener noreferrer" className={UI.linkSmall}>Cochrane certainty-of-evidence method</a> · <a href="https://ncats.nih.gov/about/about-translational-science/spectrum" target="_blank" rel="noopener noreferrer" className={UI.linkSmall}>NIH translational research stages</a>.
            </p>
          </NumberedSection>
        </div>
      </Section>

      <PageFootnote href="/intelligence/market#browse" linkLabel="Back to the research market">
        Editorial file-coverage letters, not grades of clinical effectiveness or material quality. No purchasing, clinical advice or laboratory certification.
      </PageFootnote>
    </div>
  );
}

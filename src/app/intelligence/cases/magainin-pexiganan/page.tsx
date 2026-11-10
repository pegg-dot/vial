import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpenCheck, ChevronDown, Dna, ExternalLink, ShieldAlert } from "lucide-react";
import {
  guidedCaseMarkdown, guidedCaseSource, MAGAININ_PEXIGANAN_CASE,
  type GuidedResearchSource,
} from "@/lib/research-guided-case";
import { ResearchWorkpaperActions } from "@/components/intelligence/research-workpaper-actions";
import {
  Chip, ContentsLayout, Frame, Notice, NumberedSection, PageFootnote, PageHero, Pill, Quiet, RecordList, Section, TONE_ACCENT, UI,
} from "@/components/intelligence/research-ui";
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

// The same four sections, in the same order, for every guided case.
const CONTENTS = [
  { id: "case-observations", label: "What the sources establish" },
  { id: "case-register", label: "Source register" },
  { id: "case-follow-up", label: "Continue the research" },
  { id: "case-limits", label: "Limits and related" },
] as const;

export default function MagaininPexigananGuidedCase() {
  const caseStudy = MAGAININ_PEXIGANAN_CASE;
  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      <PageHero art={["molecule", "flask"]}
        breadcrumb={[{ href: "/intelligence/market", label: "Research Market" }, { label: "Guided research example" }]}
        eyebrow={<><Dna className="size-4" aria-hidden="true" /> Guided evidence workpaper</>}
        title="When related peptides are not the same evidence."
        lead={caseStudy.question}
        note={"Source-check editorial review " + caseStudy.updatedAt + " · Pexiganan passport source check " + PEXIGANAN_REVIEW_DATE + " · not an exhaustive literature review and not a scientific verdict."}
        actions={<>
          <Pill href="/intelligence/compare?subjects=magainin-2%2Cpexiganan&audience=researcher" variant="primary" arrow="right">Compare the molecules</Pill>
          <Pill href="/intelligence/studies/NCT01594762" arrow="right">Inspect the clinical trial</Pill>
          <Pill href="/intelligence/passports/pexiganan" variant="ghost" arrow="right">Pexiganan evidence passport</Pill>
        </>}
        aside={
          <Frame tone="mint">
            <p className={"text-[11px] font-extrabold uppercase tracking-[.12em] " + TONE_ACCENT.mint}>The short answer</p>
            <p className="mt-2 text-base font-bold leading-7 text-[#111214]">{caseStudy.shortAnswer}</p>
            <p className={UI.small + " mt-3"}>Three observations from original molecular records, a biophysical experiment, a secondary scientific review and an official trial registration. This is not an exhaustive literature review.</p>
          </Frame>
        }
      />

      <Section tight>
        <ContentsLayout contents={CONTENTS} label="Case sections">
          <NumberedSection id="case-observations" number={1} eyebrow="Trace the original evidence" title="Three things the sources actually establish" flush
            intro="Every step keeps its own supporting sources and its own limitations. No claim inherits evidence merely because the peptide names are similar.">
            <div className="divide-y-2 divide-[#111214]/10">
              {caseStudy.observations.map((observation, index) => (
                <article key={observation.id} className="grid gap-5 px-5 py-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                  <div className="min-w-0">
                    <p className={UI.eyebrow}><span className="font-mono">{String(index + 1).padStart(2, "0")}</span> · Observation</p>
                    <h3 className={UI.h3 + " mt-2 leading-6"}>{observation.short}</h3>
                    <p className={UI.bodyInk + " mt-2 leading-7"}>{observation.observation}</p>
                    <Notice tone="warn" title="Important limitation" className="mt-4">
                      <p className="text-xs leading-6">{observation.notEstablished}</p>
                    </Notice>
                  </div>
                  <Quiet className="self-start">
                    <p className={UI.eyebrowMuted}>Supporting original sources · {observation.sourceIds.length}</p>
                    <ul className="mt-2 grid gap-2">
                      {observation.sourceIds.map(id => {
                        const source = guidedCaseSource(id);
                        return source ? (
                          <li key={id}>
                            <a href={source.url} target="_blank" rel="noopener noreferrer" className={UI.linkSmall}>
                              {roleNames[source.type]}{source.type === "molecular-identity" ? (source.id === "magainin-identity" ? " · Magainin 2" : " · Pexiganan") : ""} <ArrowUpRight className="size-3" aria-hidden="true" />
                            </a>
                          </li>
                        ) : null;
                      })}
                    </ul>
                  </Quiet>
                </article>
              ))}
            </div>
          </NumberedSection>

          <NumberedSection id="case-register" number={2} eyebrow="Source register" title="Every record behind this case" flush
            intro="Each source is cited by its original URL and role. Expand for classifications and specific limitations.">
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 hover:bg-[#eef0ff] [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2"><BookOpenCheck className="size-4 text-[#2b31d8]" aria-hidden="true" /><h3 className={UI.h4}>Full source register · 5 records</h3></span>
                <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="divide-y divide-[#111214]/10 border-t border-[#111214]/10">
                {caseStudy.sources.map(source => (
                  <article key={source.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <Chip tone="blue">{roleNames[source.type]}</Chip>
                      <h4 className={UI.h4 + " mt-2 break-words leading-6"}>{source.label}</h4>
                      <p className={UI.small + " mt-1 leading-6"}>{source.detail}</p>
                      <p className={"mt-1 text-xs font-medium leading-6 " + TONE_ACCENT.warn}>Limit: {source.limitation}</p>
                    </div>
                    <Pill href={source.url} external variant="ghost" size="sm" ariaLabel={"Open original source: " + source.label} className="shrink-0">
                      Open <ExternalLink className="size-3.5" aria-hidden="true" />
                    </Pill>
                  </article>
                ))}
              </div>
            </details>
          </NumberedSection>

          <NumberedSection id="case-follow-up" number={3} eyebrow="Continue the actual research" title={caseStudy.followUps.length + " checks before drawing a conclusion"}
            intro="The workpaper stops where independent appraisal starts.">
            <ol className="list-inside list-decimal space-y-3 text-sm font-medium leading-7 text-[#3a3d46]">
              {caseStudy.followUps.map((item, i) => <li key={i}>{item}</li>)}
            </ol>
            <Quiet>
              <h3 className={UI.h4}>Export the evidence, not just an AI answer</h3>
              <p className={UI.small + " mt-1.5 leading-6"}>A copyable Markdown workpaper with observed claims, original URLs and unresolved questions. Nothing is saved to your account.</p>
              <div className="mt-4">
                <ResearchWorkpaperActions markdown={guidedCaseMarkdown()} filename="vialgrade-magainin-pexiganan-evidence-workpaper.md" />
              </div>
            </Quiet>
          </NumberedSection>

          <NumberedSection id="case-limits" number={4} eyebrow="Limits and related" title="Not a scientific verdict">
            <Notice tone="warn" icon={ShieldAlert}>
              <p className="text-xs leading-6">No independently reviewed efficacy conclusion, patient outcome interpretation, regulatory decision or approved material-sourcing recommendation. An expert still needs to appraise the trial findings and article quality.</p>
            </Notice>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className={UI.eyebrowMuted}>Molecules under review</h3>
                <RecordList className="mt-2" items={[
                  { href: "/intelligence/explore/magainin-2", title: "Magainin 2", action: "Open dossier" },
                  { href: "/intelligence/explore/pexiganan", title: "Pexiganan / MSI-78", action: "Open dossier" },
                ]} />
                <p className={UI.small + " mt-2"}>Source links establish their separate molecular records. They are not a product catalog.</p>
              </div>
              <div>
                <h3 className={UI.eyebrowMuted}>Related evidence check</h3>
                <p className={UI.small + " mt-2 leading-6"}>The source-audit tool separately checks whether the official pexiganan trial has posted registry results and which cited PubMed identifiers independently refer to the exact NCT.</p>
                <Link href="/intelligence/studies/NCT01594762" className={UI.link + " mt-3"}>Run the trial check <ArrowRight className="size-3.5" aria-hidden="true" /></Link>
              </div>
            </div>
          </NumberedSection>
        </ContentsLayout>
      </Section>

      <PageFootnote href="/intelligence/market#browse" linkLabel="Back to the research market">
        Source-check editorial review {caseStudy.updatedAt}. The workpaper is a limited research starting point; professional scientific review, publication-rights checks and user-demand validation remain open. Physical peptide sales and vendor referrals are disabled.
      </PageFootnote>
    </div>
  );
}

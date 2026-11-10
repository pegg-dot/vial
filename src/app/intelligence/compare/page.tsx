import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, FileSearch, GitCompareArrows } from "lucide-react";
import { CompareTrialSource } from "@/components/intelligence/compare-trial-source";
import { ResearchFileGradeMark } from "@/components/intelligence/research-file-grade";
import {
  Chip, Frame, Notice, NumberedSection, PageFootnote, PageHero, Pill, Quiet, RecordList, Section, UI,
} from "@/components/intelligence/research-ui";
import {
  compareExplorerHref, researchSubjectBySlug, researchThemeById,
  registryDiscoveryUrl, verifiedPubmedSearchUrl, type ExplorerAudience,
} from "@/lib/research-explorer";

export const metadata: Metadata = {
  title: "Compare research subjects | VialGrade",
  description: "Compare mechanisms, research questions, identity and original source links without unsupported effectiveness rankings.",
  robots: { index: false, follow: false },
};

const AUDIENCE_LABEL: Record<ExplorerAudience, string> = { researcher: "Researcher", analyst: "Analyst" };

export default async function CompareResearchPage({ searchParams }: {
  searchParams: Promise<{ subjects?: string; audience?: string }>;
}) {
  const query = await searchParams;
  const ids = Array.from(new Set((query.subjects ?? "").slice(0, 250).split(",")
    .map(s => s.trim().toLowerCase()).filter(Boolean))).slice(0, 3);
  const subjects = ids.map(researchSubjectBySlug).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const audience: ExplorerAudience = query.audience === "analyst" ? "analyst" : "researcher";
  const paired = subjects.length >= 2;
  const caseLinked = subjects.some(s => s.slug === "magainin-2") && subjects.some(s => s.slug === "pexiganan");

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      <PageHero size="compact" art={["molecule", "flask"]}
        breadcrumb={[{ href: "/intelligence/market#browse", label: "Research Market" }, { label: "Compare" }]}
        eyebrow={<><GitCompareArrows className="size-4" aria-hidden="true" /> Scientific comparison</>}
        title="Compare compounds"
        lead="Put molecular references, study questions, and source records side by side. This is a research comparison, not a ranking of effectiveness or safety."
        note="File letters describe which source types sit in our file, not how promising or safe a compound is. One selected registry record per subject; no cross-study inference."
        actions={<>
          <Pill href="/intelligence/market#browse" variant="primary" arrow="right">{paired ? "Change the selection" : "Browse catalog"}</Pill>
          <Pill href="/intelligence/grading" variant="ghost">How our file coverage grades work</Pill>
        </>}
        aside={paired ? (
          <Frame shadow="sm" pad="sm">
            <p id="compare-emphasis" className={UI.eyebrowMuted}>Comparison emphasis</p>
            <div role="group" aria-labelledby="compare-emphasis" className="ink-1 mt-2 inline-flex rounded-full bg-white p-0.5 text-xs font-extrabold">
              {(["researcher", "analyst"] as const).map(value => (
                <Link key={value} href={compareExplorerHref(ids, value)} aria-current={audience === value ? "page" : undefined}
                  className={"inline-flex min-h-9 items-center rounded-full px-4 transition-colors " + (audience === value ? "bg-[#111214] text-white" : "text-[var(--muted)] hover:bg-[#eef0ff]")}>
                  {AUDIENCE_LABEL[value]}
                </Link>
              ))}
            </div>
            <p className={UI.small + " mt-2"}>Same records either way. This only changes which question line each card leads with.</p>
          </Frame>
        ) : undefined}
      />

      <Section tight>
        <div className="grid gap-4">
          {!paired ? (
            <NumberedSection id="compare-pick" number={1} eyebrow="Selection" title="Select two or three research subjects."
              intro="The comparison uses only curated, source-linked identities. Choose subjects from the catalog, or start from a pair already on file.">
              <RecordList items={[
                { href: compareExplorerHref(["magainin-2", "pexiganan"], "researcher"), title: "Magainin 2 and Pexiganan", note: "A natural peptide and its designed analog: separate records, separate evidence.", action: "Compare" },
                { href: compareExplorerHref(["retatrutide", "tirzepatide"], "researcher"), title: "Retatrutide and Tirzepatide", note: "Two incretin-pathway subjects, one with an unresolved compound identity.", action: "Compare" },
              ]} />
            </NumberedSection>
          ) : (
            <>
              {caseLinked && (
                <Notice tone="mint" icon={BookOpen} title="Source-backed case study">
                  <p>
                    Why a membrane experiment and a pexiganan trial cannot be treated as the same evidence.{" "}
                    <Link href="/intelligence/cases/magainin-pexiganan" className={UI.link}>Read the source trail <ArrowRight className="size-4" aria-hidden="true" /></Link>
                  </p>
                </Notice>
              )}

              <NumberedSection id="compare-subjects" number={1} eyebrow="Side by side" title={(subjects.length === 3 ? "Three" : "Two") + " compounds, one card each"}
                intro={"Mechanism, " + (audience === "analyst" ? "diligence" : "research") + " question, molecular identity, one selected registry record and the original source links for each subject."}>
                <div className={"grid gap-4 md:grid-cols-2 " + (subjects.length === 3 ? "xl:grid-cols-3" : "xl:grid-cols-2")}>
                  {subjects.map(subject => {
                    const theme = researchThemeById(subject.theme);
                    return (
                      <Frame as="article" key={subject.slug} thin shadow="none" radius="rounded-[14px]" pad="sm" className="flex min-w-0 flex-col">
                        <div><Chip tone="blue">{theme.name}</Chip></div>
                        <h2 className={UI.h3 + " mt-3 break-words"}>{subject.name}</h2>
                        <p className={UI.small + " mt-1"}>{subject.family}</p>
                        <div className="mt-3"><ResearchFileGradeMark subject={subject} withCount /></div>
                        <dl className="mt-5 space-y-4">
                          <div><dt className={UI.eyebrowMuted}>Mechanism or experimental focus</dt><dd className={UI.bodyInk + " mt-1.5"}>{subject.mechanism}</dd></div>
                          <div><dt className={UI.eyebrowMuted}>{audience === "analyst" ? "Diligence question" : "Research question"}</dt><dd className={UI.bodyInk + " mt-1.5"}>{audience === "analyst" ? subject.analystAngle : subject.studyQuestion}</dd></div>
                          <div><dt className={UI.eyebrowMuted}>Molecular identity</dt><dd className="mt-1.5 break-words text-sm font-bold text-[#111214]">{subject.referenceLabel}</dd></div>
                        </dl>
                        <Notice tone="warn" title="Important limitation" className="mt-4">
                          <p className="text-xs leading-5">{subject.identityCaveat}</p>
                        </Notice>
                        <div className="mt-4">
                          <Suspense fallback={<Quiet className="text-xs font-medium text-[var(--muted)]">Checking official study sources…</Quiet>}>
                            <CompareTrialSource subject={subject} />
                          </Suspense>
                        </div>
                        <div className="mt-auto pt-5">
                          <RecordList items={[
                            { href: subject.referenceUrl, external: true, icon: CheckCircle2, title: "PubChem identity", action: "Open PubChem" },
                            { href: verifiedPubmedSearchUrl(subject), external: true, icon: BookOpen, title: "PubMed search", action: "Search PubMed" },
                            { href: registryDiscoveryUrl(subject), external: true, icon: FileSearch, title: "Registry search", action: "Search ClinicalTrials.gov" },
                          ]} />
                          <Pill href={"/intelligence/explore/" + subject.slug} variant="ink" arrow="right" className="mt-4 w-full">Open research dossier</Pill>
                        </div>
                      </Frame>
                    );
                  })}
                </div>
              </NumberedSection>

              <NumberedSection id="compare-limits" number={2} eyebrow="Limits" title="What this comparison is not">
                <Notice tone="warn">
                  <p>The selected study panels contain ONE registry record per subject, not a comparative or head-to-head clinical evaluation. Comparison means differences in research questions, peptide identity, and the kinds of original records worth reviewing. There is no automatic cross-study inference or numerical ranking. These search links have not been independently screened for source relevance.</p>
                </Notice>
              </NumberedSection>
            </>
          )}
        </div>
      </Section>

      <PageFootnote href="/intelligence/market#browse" linkLabel="Back to Research Explorer">
        Editorial research starting points, not grades of clinical effectiveness or material quality. No purchasing, clinical advice or laboratory certification.
      </PageFootnote>
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight, BookOpenCheck, ChevronDown } from "lucide-react";
import {
  cagrilintideAuditMarkdown,
  getAuditCounts,
  getCagrilintideAudit,
  getCagrilintideAuditInsights,
  type CagrilintideAuditRow,
  type CagrilintideStudy,
  type AuditInsight,
} from "@/server/intelligence/cagrilintide-study-audit";
import { ResearchAuditExport } from "@/components/intelligence/research-audit-export";
import {
  Chip, ContentsLayout, Facts, Frame, Notice, NumberedSection, PageFootnote, PageHero, Pill, Quiet, Section, Stat, UI,
} from "@/components/intelligence/research-ui";

export const metadata: Metadata = {
  title: "Cagrilintide study audit",
  description: "Trace selected primary-source study designs, reporting status and unresolved questions; not an efficacy comparison.",
  robots: { index: false, follow: false },
};
export const revalidate = 21_600;

// The same four sections, in the same order, every visit.
const CONTENTS = [
  { id: "findings", label: "Follow-up flags" },
  { id: "audit-studies", label: "Study-design audit" },
  { id: "audit-questions", label: "Open questions" },
  { id: "audit-limits", label: "Limits" },
] as const;

function dateText(date: { date: string; precision: string } | null) {
  return date ? date.date + " (" + date.precision.toLowerCase() + ")" : "Not reported";
}

function resultLabel(value: CagrilintideStudy["registryResults"]) {
  return value === "present" ? "Registry results section present"
    : value === "not-shown" ? "No registry results section returned"
      : "Results-section state unverified";
}

function InsightCard({ insight }: { insight: AuditInsight }) {
  return (
    <Frame as="article" thin shadow="none" radius="rounded-[14px]" pad="sm" className="min-w-0">
      <h3 className={UI.h4}>{insight.heading}</h3>
      <p className={UI.bodyInk + " mt-2"}>{insight.observation}</p>
      <p className={UI.small + " mt-2"}><span className="font-extrabold text-[#9b6b22]">Why this needs care · </span>{insight.interpretationLimit}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {insight.sources.map(source => (
          <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className={UI.linkSmall + " break-words"}>
            {source.title} <ArrowUpRight className="size-3" aria-hidden="true" />
          </a>
        ))}
      </div>
    </Frame>
  );
}

// Every study row is one `article` carrying its NCT id in a `span.font-mono`; the audit test counts exactly four.
function StudyCard({ row }: { row: CagrilintideAuditRow }) {
  const isCombination = row.selection.scope === "combination-name";
  return (
    <article className="px-5 py-6">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={isCombination ? "warn" : "mint"}>{isCombination ? "Combination-name example" : "Direct molecule-name example"}</Chip>
        <span className="break-all font-mono text-xs font-bold text-[#4a4d56]">{row.selection.nctId}</span>
      </div>
      {!row.available ? (
        <>
          <h3 className={UI.h3 + " mt-4"}>Official record unavailable</h3>
          <p className={UI.body + " mt-2"}>The source could not be fetched or parsed. Its absence is not evidence about the study.</p>
          <a className={UI.link + " mt-3"} href={"https://clinicaltrials.gov/study/" + row.selection.nctId} target="_blank" rel="noopener noreferrer">
            Open original registry record <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        </>
      ) : (
        <>
          <h3 className={UI.h3 + " mt-4 break-words leading-7"}>{row.study.title}</h3>
          <p className={UI.small + " mt-2"}>{row.selection.whySelected}</p>
          <a href={row.study.url} target="_blank" rel="noopener noreferrer" className={UI.link + " mt-3"}>
            Original ClinicalTrials.gov record <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
          <Facts tone="paper" cols={3} className="mt-5" items={[
            { term: "Registered status", detail: row.study.status?.replaceAll("_", " ") ?? "Unknown" },
            { term: "Registry results", detail: resultLabel(row.study.registryResults) },
            { term: "First recorded primary outcome", detail: row.study.primaryOutcomes[0]?.measure ?? "Not available" },
          ]} />

          <section aria-label={"Publication source links for " + row.study.nctId} className="mt-5 rounded-[14px] border border-[#2b31d8]/25 bg-[#eef0ff] p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <BookOpenCheck className="size-5 shrink-0 text-[#2b31d8]" aria-hidden="true" />
              <h4 className={UI.h4}>Publication evidence linked to this study</h4>
            </div>
            <p className={UI.small + " mt-2 text-[#3a3d46]"}>
              These are PubMed IDs explicitly cited in the ClinicalTrials.gov protocol.
              The registry assigns the reference label; PubMed independently checks whether it indexes the exact NCT ID.
              Neither source by itself establishes clinical findings.
            </p>
            {row.study.registryReferences.length ? (
              <div className="mt-4 space-y-3">
                {row.study.registryReferences.map(reference => {
                  const check = row.study.pubmedChecks.find(item => item.reference.pmid === reference.pmid);
                  return (
                    <div key={reference.pmid} className="ink-1 min-w-0 rounded-[12px] bg-white p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Chip tone="blue">Registry label: {reference.role}</Chip>
                        <span className="font-mono text-[11px] font-bold text-[#4a4d56]">PMID {reference.pmid}</span>
                      </div>
                      <p className="mt-3 break-words text-sm font-extrabold leading-6 text-[#111214]">{check?.article?.title ?? reference.citation ?? "Publication metadata not available"}</p>
                      {check?.article && (
                        <p className={UI.small + " mt-1"}>
                          {check.article.journal ?? "Journal not reported"} · {check.article.publicationDate ?? "Date not reported"}
                        </p>
                      )}
                      <p className={UI.small + " mt-2"}>
                        {check?.secondaryIdMatch === "confirmed"
                          ? "PubMed also indexes this article under the exact study ID."
                          : check?.secondaryIdMatch === "not-corroborated"
                            ? "The exact NCT-to-PMID link was not corroborated by PubMed indexing; review the sources."
                            : "Independent PubMed linkage could not be checked; this is still a registry-supplied citation."}
                      </p>
                      {reference.role === "BACKGROUND" && (
                        <p className="mt-2 text-xs font-medium leading-5 text-[#9b6b22]">
                          The registry calls this BACKGROUND, even if PubMed indexes the study ID. Read the article before classifying the findings.
                        </p>
                      )}
                      <a href={"https://pubmed.ncbi.nlm.nih.gov/" + reference.pmid + "/"} target="_blank" rel="noopener noreferrer" className={UI.linkSmall + " mt-3"}>
                        Read PubMed record <ArrowUpRight className="size-3.5" aria-hidden="true" />
                      </a>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={UI.small + " mt-3"}>
                No PMID is listed in the protocol reference fields of this retrieved record.
                This is not evidence that no publications exist elsewhere.
              </p>
            )}
          </section>

          <details className="group mt-5 overflow-hidden rounded-[14px] border border-[#111214]/15 bg-white">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-extrabold text-[#111214] hover:bg-[#eef0ff] [&::-webkit-details-marker]:hidden">
              Inspect study interventions, dates and registered outcomes
              <ChevronDown className="size-4 shrink-0 text-[#2b31d8] transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="space-y-5 border-t border-[#111214]/15 px-4 py-5 sm:px-5">
              <Facts cols={4} items={[
                { term: "Registry status", detail: row.study.status?.replaceAll("_", " ") ?? "Not reported" },
                { term: "Phase", detail: row.study.phase?.replaceAll("PHASE", "Phase ") ?? "Not reported" },
                { term: "Enrollment", detail: row.study.enrollment ? row.study.enrollment.count.toLocaleString("en-US") + " (" + row.study.enrollment.precision.toLowerCase() + ")" : "Not reported" },
                { term: "Primary completion", detail: dateText(row.study.primaryCompletion) },
                { term: "Sponsor", detail: row.study.sponsor ?? "Not reported" },
                { term: "Results in registry", detail: resultLabel(row.study.registryResults) },
                { term: "Record last updated", detail: row.study.lastRegistryUpdate ?? "Not reported" },
              ]} />
              <div className="grid gap-4 lg:grid-cols-2">
                <Quiet as="section">
                  <h4 className={UI.h4}>Interventions actually named</h4>
                  {row.study.interventions.length ? (
                    <ul className={UI.small + " mt-3 list-disc space-y-1 pl-5"}>
                      {row.study.interventions.map((name, i) => <li key={i}>{name}</li>)}
                    </ul>
                  ) : <p className={UI.small + " mt-3"}>Not available in record.</p>}
                  <p className={UI.small + " mt-3"}>Compound name match: {row.study.matchLocation.replaceAll("-", " ")}. This is not a verification of molecule composition or clinical benefit.</p>
                </Quiet>
                <Quiet as="section">
                  <h4 className={UI.h4}>Primary outcomes registered</h4>
                  {row.study.primaryOutcomes.length ? (
                    <ul className={UI.small + " mt-3 space-y-3"}>
                      {row.study.primaryOutcomes.map((outcome, i) => (
                        <li key={i}><strong className="text-[#111214]">{outcome.measure}</strong><p>{outcome.timeFrame ? "Time frame: " + outcome.timeFrame : "Time frame not reported"}</p></li>
                      ))}
                    </ul>
                  ) : <p className={UI.small + " mt-3"}>No parseable outcome measures returned.</p>}
                  {row.study.primaryOutcomeCount > row.study.primaryOutcomes.length && (
                    <p className={UI.small + " mt-3 text-[#111214]"}>Additional primary outcomes exist; open the original registry to review all.</p>
                  )}
                </Quiet>
                <Quiet as="section" className="lg:col-span-2">
                  <h4 className={UI.h4}>Registered participants and study arms</h4>
                  <p className={UI.small + " mt-2"}>
                    These are copied from the registry metadata to help check study context.
                    They are not an independently verified description of each person enrolled.
                  </p>
                  <Facts cols={2} className="mt-4" items={[
                    { term: "Conditions", detail: row.study.population.conditions.join(", ") || "Not reported" },
                    { term: "Age eligibility", detail: (row.study.population.minimumAge ?? "Not reported") + " to " + (row.study.population.maximumAge ?? "no stated maximum") },
                    { term: "Registered sex eligibility", detail: row.study.population.sex ?? "Not reported" },
                    { term: "Healthy volunteers", detail: row.study.population.healthyVolunteers === true ? "Accepted by registry eligibility" : row.study.population.healthyVolunteers === false ? "Not accepted by registry eligibility" : "Not specified" },
                  ]} />
                  {row.study.population.armLabels.length > 0 && (
                    <div className="mt-5 border-t border-[#111214]/15 pt-4">
                      <p className={UI.eyebrowMuted}>Original study arm labels (limited sample)</p>
                      <ul className={UI.small + " mt-2 list-disc space-y-1 pl-5"}>
                        {row.study.population.armLabels.map((label, i) => <li key={i}>{label}</li>)}
                      </ul>
                      <p className={UI.small + " mt-2"}>Trial design information, not administration instructions.</p>
                    </div>
                  )}
                </Quiet>
              </div>
            </div>
          </details>
        </>
      )}
    </article>
  );
}

export default async function CagrilintideAuditPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  if (topic !== "cagrilintide") notFound();
  const audit = await getCagrilintideAudit();
  const counts = getAuditCounts(audit);
  const insights = getCagrilintideAuditInsights(audit);
  const topFindings = insights.filter(item => [
    "A results publication exists outside the registry results section",
    "A registry BACKGROUND citation is linked to the same study in PubMed",
  ].includes(item.heading));
  const highlighted = topFindings.length ? topFindings : insights.slice(0, 2);
  const remainingInsights = insights.filter(item => !highlighted.includes(item));
  const featured = audit.rows.find(row => row.selection.nctId === "NCT05804162");
  const sourceState = featured?.available ? featured.study.registryResults : null;
  const paper = featured?.available ? featured.study.pubmedChecks.find(check =>
    check.reference.pmid === "39279639" && check.reference.role === "RESULT") : null;
  const featuredVerified = sourceState === "not-shown" && paper?.secondaryIdMatch === "confirmed" && paper.article !== null;

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      <PageHero art={["magnifier", "coa"]}
        breadcrumb={[
          { href: "/intelligence", label: "Home" },
          { href: "/intelligence/cagrilintide", label: "Cagrilintide" },
          { label: "Study audit" },
        ]}
        eyebrow="Source-audited research task · Prototype"
        title="Did this clinical trial publish any findings?"
        lead="We checked whether trial NCT05804162 has results in its official registry record, and whether a published paper can be linked to the same study. Then we compare the source details across four selected trials to show what a researcher would need to verify."
        note={"This is a worked example with four selected records, not a general trial-search engine. Assembled " + audit.assembledAt + "."}
        actions={<ResearchAuditExport markdown={cagrilintideAuditMarkdown(audit)} />}
      />

      <Section tight>
        <Frame as="section" ariaLabel="Example answer" tone="blue" pad="lg" className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
          <div>
            <p className={UI.eyebrow}>The question we are testing</p>
            <h2 className={UI.h2 + " mt-3"}>If the trial registry has no posted results, does that mean no paper exists?</h2>
            <p className={UI.bodyInk + " mt-4 text-base leading-7"}>
              {featuredVerified
                ? "No. For this example, ClinicalTrials.gov has no posted results section, but PubMed lists a paper indexed under the exact same trial ID. That relationship is independently checked."
                : "We cannot currently verify both original sources. The paper and trial links below are available for direct review, but VialGrade will not claim the connection is confirmed during a source outage or record change."}
            </p>
            <p className={UI.small + " mt-3"}>
              Why this matters: researchers can miss relevant work when registry results and published articles are stored in different places.
              Finding a paper does not prove its conclusions or settle reporting requirements.
            </p>
            <a href="#findings" className={UI.link + " mt-4"}>See exactly what we checked <ArrowRight className="size-4" aria-hidden="true" /></a>
          </div>
          <div className="grid gap-3">
            <Pill href="https://clinicaltrials.gov/study/NCT05804162" external variant="secondary" arrow="up" className="w-full">Official trial NCT05804162</Pill>
            <Pill href="https://pubmed.ncbi.nlm.nih.gov/39279639/" external variant="secondary" arrow="up" className="w-full">PubMed paper PMID 39279639</Pill>
          </div>
        </Frame>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat value={counts.selected} label="Selected studies"
            note={counts.unavailable ? counts.unavailable + " source(s) unavailable" : "All selected sources available"} />
          <Stat value={counts.directWithResultsSection} label="Direct-name examples with registry results"
            note="Separate from linked publications and not proof of benefit" />
          <Stat value={counts.withoutRegistryResultsButWithResultPaper === 0 && counts.missingRegistryResultsWithUnverifiedPaper > 0 ? "Unknown" : counts.withoutRegistryResultsButWithResultPaper}
            label="No registry results, but an independently linked RESULT paper"
            note={counts.missingRegistryResultsWithUnverifiedPaper > 0
              ? "Some PubMed source checks were unavailable; unknown does not mean no paper exists"
              : "An independently linked source is not a clinical or legal conclusion"} />
        </div>

        {counts.directNameUnconfirmed > 0 && (
          <Notice role="status" tone="warn" className="mt-4">
            Some previously selected direct-name records do not currently match the molecule in the official intervention fields.
            Review those sources before drawing even preliminary conclusions.
          </Notice>
        )}

        <ContentsLayout contents={CONTENTS} label="Audit sections" className="mt-6">
          <NumberedSection id="findings" number={1} eyebrow="Follow-up" title="What the records flag for follow-up"
            intro="Start with the source relationships that could change what a researcher checks next. Registered design differences and other verification questions remain below. These are factual checks, not automated clinical judgments.">
            {insights.length ? (
              <>
                <div className="grid gap-3 lg:grid-cols-2">
                  {highlighted.map(item => <InsightCard key={item.heading} insight={item} />)}
                </div>
                {remainingInsights.length > 0 && (
                  <details className="group overflow-hidden rounded-[14px] border border-[#111214]/15 bg-white">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-extrabold text-[#111214] hover:bg-[#eef0ff] [&::-webkit-details-marker]:hidden">
                      {"Show " + remainingInsights.length + " additional study-design checks"}
                      <ChevronDown className="size-4 shrink-0 text-[#2b31d8] transition-transform group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <div className="grid gap-3 border-t border-[#111214]/15 bg-[#fbfbf8] p-4 lg:grid-cols-2">
                      {remainingInsights.map(item => <InsightCard key={item.heading} insight={item} />)}
                    </div>
                  </details>
                )}
              </>
            ) : (
              <Notice tone="paper">
                The current selection does not support a source-audited finding. Check unavailable records and original sources directly.
              </Notice>
            )}
          </NumberedSection>

          <NumberedSection id="audit-studies" number={2} eyebrow="Four selected trials" title="Study-design audit" flush
            intro="A useful starting point for an analyst, not a head-to-head efficacy comparison. Study populations, doses, endpoints and designs can differ substantially. Registry results and published papers are checked separately to avoid hiding existing citations.">
            <div className="divide-y-2 divide-[#111214]/10">
              {audit.rows.map(row => <StudyCard key={row.selection.nctId} row={row} />)}
            </div>
          </NumberedSection>

          <NumberedSection id="audit-questions" number={3} eyebrow="Open questions" title="Questions the current evidence cannot answer">
            <Notice tone="warn">
              <ol className="list-decimal space-y-2 pl-5 text-xs leading-6">
                <li>Are other relevant cagrilintide studies missing from this deliberately selected sample?</li>
                <li>What primary-source evidence establishes the relationship between CagriSema and its component molecules?</li>
                <li>Are study populations and outcome definitions comparable enough to support any cross-study conclusion?</li>
                <li>For records with linked RESULT or BACKGROUND citations, do the actual full articles support the particular research question, and are any other relevant papers missing?</li>
                <li>What changed since a prior date? No two verified historical versions have been captured for this feature.</li>
              </ol>
            </Notice>
          </NumberedSection>

          <NumberedSection id="audit-limits" number={4} eyebrow="Limits" title="What this prototype proves and what it does not">
            <p className={UI.bodyInk}>
              It turns official structured records into a task-based audit with inspectable sources.
              It now cross-checks explicit registry references against PubMed IDs and independently indexed trial associations.
              This does not compare numerical outcomes, validate full article claims, infer efficacy or establish regulatory status.
              A repeatable change report requires dated source snapshots. No personalized research profile is created.
            </p>
          </NumberedSection>
        </ContentsLayout>
      </Section>

      <PageFootnote href="/how-we-check#grade-checks" linkLabel="How we check">
        Source responses can be cached for up to six hours; assembling an audit is not the same as fetching a new upstream version.
        Four manually pinned public NCT IDs; no user query, profile, database, paid API, model call or third-party full text.
      </PageFootnote>
    </div>
  );
}

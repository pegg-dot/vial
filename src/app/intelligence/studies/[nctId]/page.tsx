import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, ChevronDown, FileCheck2, FileSearch } from "lucide-react";
import { normalizeNctId } from "@/lib/nct-identifier";
import { lookupStudy, studySourceBrief, summarizeStudyEvidence } from "@/server/intelligence/study-lookup";
import { StudyLookupForm } from "@/components/intelligence/study-lookup-form";
import { StudyBriefActions } from "@/components/intelligence/study-brief-actions";
import {
  Chip, ContentsLayout, Facts, Frame, IconTile, Notice, NumberedSection, PageFootnote, PageHero, Pill, Quiet, Section, TONE_ACCENT, UI,
} from "@/components/intelligence/research-ui";
import { PEXIGANAN_TRIAL_SELECTION } from "@/lib/pexiganan-evidence-network";

export const metadata: Metadata = {
  title: "Check a clinical trial | VialGrade",
  description: "Check registry results and exact trial-to-publication relationships in original public sources.",
  robots: { index: false, follow: false },
};

// The same four sections, in the same order, for every study.
const CONTENTS = [
  { id: "study-answer", label: "Short answer" },
  { id: "study-sources", label: "Original sources" },
  { id: "study-design", label: "Registered design" },
  { id: "study-brief", label: "Take it with you" },
] as const;

function ExternalSource({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={UI.link}>{children}<ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" /></a>;
}

export default async function StudySourcePage({ params }: { params: Promise<{ nctId: string }> }) {
  const { nctId: raw } = await params;
  const id = normalizeNctId(raw);
  if (!id) notFound();
  const result = await lookupStudy(id);
  const connectedToPexiganan = PEXIGANAN_TRIAL_SELECTION.some(record => record.nctId === id);
  const breadcrumb = [{ href: "/intelligence/market", label: "Research Market" }, { label: "Study " + id }] as const;
  const eyebrow = <><FileSearch className="size-4" aria-hidden="true" /> Study source check · {id}</>;

  if (result.state !== "available") return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      <PageHero size="compact" art={["magnifier"]} breadcrumb={breadcrumb} eyebrow={eyebrow}
        title={result.state === "not-found" ? "Study not found" : "Registry temporarily unavailable"}
        lead={result.state === "not-found"
          ? "ClinicalTrials.gov returned no record for " + id + ". Check the identifier or try another."
          : "We could not verify this registry response. That does not establish that the study or its papers are missing."}
        note={"Checked " + result.checkedAt + " · NIH responses may be cached for up to six hours."}
        actions={<>
          <Pill href={"https://clinicaltrials.gov/study/" + id} external variant="primary" arrow="up">Check ClinicalTrials.gov directly</Pill>
          <Pill href="/intelligence#trial-lookup" variant="ghost" icon={ArrowLeft}>Back to study lookup</Pill>
        </>}
        aside={<Frame><StudyLookupForm initialId={id} compact /></Frame>}
      />
      <PageFootnote href="/intelligence/grading" linkLabel="How we check">
        No research profile is created, though normal hosting logs may record a request. VialGrade provides no purchase or medical-advice features.
      </PageFootnote>
    </div>
  );

  const study = result.study;
  const summary = summarizeStudyEvidence(study);
  const registryResult = study.registryResults === "present" ? "Posted" : study.registryResults === "not-shown" ? "Not posted" : "Unknown";
  const refPairs = study.registryReferences.map(reference => ({
    reference,
    check: study.pubmedChecks.find(check => check.reference.pmid === reference.pmid),
  }));
  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      <PageHero size="compact" art={["magnifier", "coa"]} breadcrumb={breadcrumb} eyebrow={eyebrow}
        title={"Evidence for " + id}
        lead={study.title}
        note={"Live registry and PubMed check · " + result.checkedAt + " · responses may be cached for up to six hours."}
        actions={<>
          <Pill href="#study-sources" variant="primary" arrow="right">See the original sources</Pill>
          <Pill href="/intelligence#trial-lookup" variant="ghost" icon={ArrowLeft}>Back to study lookup</Pill>
        </>}
        aside={<Frame><StudyLookupForm compact initialId={id} /></Frame>} asideClassName="hidden lg:block"
      />

      <Section tight>
        <div className="grid gap-4">
          {connectedToPexiganan && (
            <Frame as="section" tone="mint" shadow="none" thin radius="rounded-[14px]" pad="sm" ariaLabel="Pexiganan evidence network link"
              className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <p className={"text-xs font-extrabold " + TONE_ACCENT.mint}>Connected to Pexiganan research</p>
                <p className={UI.small + " mt-1"}>This is one of four curated registry records. The evidence passport shows its molecular, article and sponsor relationships without assuming clinical benefit.</p>
              </div>
              <Pill href="/intelligence/passports/pexiganan" variant="mint" size="sm" arrow="up" className="shrink-0">Evidence passport</Pill>
            </Frame>
          )}

          <ContentsLayout contents={CONTENTS} label="Study sections">
            <NumberedSection id="study-answer" number={1} eyebrow="The short answer" title={summary.headline} intro={summary.detail}>
              <Facts tone="mint" cols={3} items={[
                { term: "Registry results", detail: registryResult },
                { term: "PubMed links confirmed", detail: summary.confirmedLinks + " / " + summary.linkedPapers + " registry citations" },
                { term: "Study status", detail: <span className="capitalize">{study.status?.replaceAll("_", " ").toLowerCase() ?? "Not reported"}</span> },
              ]} />
            </NumberedSection>

            <NumberedSection id="study-sources" number={2} eyebrow="Original sources" title="Original sources" flush
              intro="The study record, then papers explicitly listed by the registry. This is not a full literature search.">
              <div className="flex gap-3 px-5 py-5">
                <IconTile icon={FileCheck2} size="sm" />
                <div className="min-w-0">
                  <h3 className={UI.h4 + " break-words"}>ClinicalTrials.gov · {id}</h3>
                  <p className={UI.small + " mt-1 leading-6"}>Record updated {study.lastRegistryUpdate ?? "date not reported"}. Registry results {registryResult.toLowerCase()}.</p>
                  <div className="mt-2"><ExternalSource href={study.url}>Open registry record</ExternalSource></div>
                </div>
              </div>
              <div className="border-t-2 border-[#111214]/10 bg-[#fbfbf8] px-5 py-2.5"><p className={UI.eyebrowMuted}>Papers cited in this registry</p></div>
              {refPairs.length ? refPairs.map(({ reference, check }) => (
                <article key={reference.pmid} className="border-t border-[#111214]/10 px-5 py-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone="blue">Registry label · {reference.role}</Chip>
                    <span className="font-mono text-xs font-bold text-[#4a4d56]">PMID {reference.pmid}</span>
                  </div>
                  <h3 className={UI.h4 + " mt-3 leading-6"}>{check?.article?.title ?? reference.citation ?? "Publication metadata unavailable"}</h3>
                  {check?.article && <p className={UI.small + " mt-1"}>{check.article.journal ?? "Journal unknown"} · {check.article.publicationDate ?? "Date unknown"}</p>}
                  <p className={UI.bodyInk + " mt-2"}>
                    {check?.secondaryIdMatch === "confirmed"
                      ? "PubMed independently indexes this publication under the same trial ID."
                      : check?.secondaryIdMatch === "not-corroborated"
                        ? "PubMed did not corroborate the exact trial ID. Review the original paper."
                        : "The PubMed check was unavailable. The registry citation is not an independently verified match."}
                  </p>
                  <div className="mt-3"><ExternalSource href={"https://pubmed.ncbi.nlm.nih.gov/" + reference.pmid + "/"}>Open PubMed record</ExternalSource></div>
                </article>
              )) : <p className={UI.body + " border-t border-[#111214]/10 px-5 py-5"}>No PubMed IDs were listed in the checked registry fields. Papers may exist elsewhere.</p>}
            </NumberedSection>

            <NumberedSection id="study-design" number={3} eyebrow="Registered design" title="What the registry says the study is" flush
              intro="Sponsor, phase, population and the first registered primary outcomes, exactly as the record lists them.">
              <details className="group">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-extrabold text-[#111214] hover:bg-[#eef0ff] [&::-webkit-details-marker]:hidden">
                  Study design and registered outcomes <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="border-t border-[#111214]/10 px-5 py-5">
                  <dl className="grid gap-5 sm:grid-cols-2">
                    <div><dt className={UI.eyebrowMuted}>Sponsor</dt><dd className="mt-1 text-sm font-bold text-[#111214]">{study.sponsor ?? "Not reported"}</dd></div>
                    <div><dt className={UI.eyebrowMuted}>Phase</dt><dd className="mt-1 text-sm font-bold text-[#111214]">{study.phase?.replaceAll("PHASE", "Phase ") ?? "Not reported"}</dd></div>
                    <div><dt className={UI.eyebrowMuted}>Conditions</dt><dd className="mt-1 text-sm font-bold text-[#111214]">{study.population.conditions.join(", ") || "Not reported"}</dd></div>
                    <div><dt className={UI.eyebrowMuted}>Enrollment</dt><dd className="mt-1 text-sm font-bold text-[#111214]">{study.enrollment ? study.enrollment.count.toLocaleString() + " (" + study.enrollment.precision.toLowerCase() + ")" : "Not reported"}</dd></div>
                    <div className="sm:col-span-2"><dt className={UI.eyebrowMuted}>Registered interventions</dt><dd className="mt-1 text-sm font-bold text-[#111214]">{study.interventions.join(", ") || "Not reported"}</dd></div>
                    <div className="sm:col-span-2">
                      <dt className={UI.eyebrowMuted}>First primary outcomes (up to three)</dt>
                      <dd className="mt-2">
                        {study.primaryOutcomes.length
                          ? <ul className="list-inside list-disc space-y-1.5 text-sm font-medium leading-6 text-[#3a3d46]">{study.primaryOutcomes.map((o, i) => <li key={i}>{o.measure}{o.timeFrame && <span className="text-[var(--muted)]"> · {o.timeFrame}</span>}</li>)}</ul>
                          : <span className="text-sm font-bold text-[#111214]">Not reported</span>}
                      </dd>
                    </div>
                  </dl>
                  <Notice tone="warn" className="mt-4"><p className="text-xs leading-5">Registry-provided study design, not a clinical outcome or dosing recommendation.</p></Notice>
                </div>
              </details>
            </NumberedSection>

            <NumberedSection id="study-brief" number={4} eyebrow="Export" title="Take this research with you"
              intro="A brief containing the source links, checked relationships, and unresolved questions. No account or saved research profile required.">
              <StudyBriefActions markdown={studySourceBrief(result)} nctId={id} />
              <Quiet>
                <h3 className={UI.h4}>What to verify next</h3>
                <p className={UI.bodyInk + " mt-2 leading-7"}>{summary.nextQuestion}</p>
              </Quiet>
              <Notice tone="warn">
                <p className="text-xs leading-6">This only checks publication IDs explicitly cited by the registry. It does not assess study quality, effectiveness, reporting compliance or changes over time.</p>
              </Notice>
            </NumberedSection>
          </ContentsLayout>
        </div>
      </Section>

      <PageFootnote href="/intelligence/grading" linkLabel="How we check">
        Checked {result.checkedAt}. NIH responses may be cached for up to six hours. No research profile is created, though normal hosting logs may record a request. VialGrade provides no purchase or medical-advice features.
      </PageFootnote>
    </div>
  );
}

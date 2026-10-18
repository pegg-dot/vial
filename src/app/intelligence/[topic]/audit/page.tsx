import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, AlertTriangle, BookOpenCheck, ChevronDown, GitCompareArrows } from "lucide-react";
import {
  cagrilintideAuditMarkdown,
  getAuditCounts,
  getCagrilintideAudit,
  getCagrilintideAuditInsights,
  type CagrilintideAuditRow,
  type CagrilintideStudy,
} from "@/server/intelligence/cagrilintide-study-audit";
import { ResearchAuditExport } from "@/components/intelligence/research-audit-export";

export const metadata: Metadata = {
  title: "Cagrilintide study audit",
  description: "Trace selected primary-source study designs, reporting status and unresolved questions; not an efficacy comparison.",
  robots: { index: false, follow: false },
};
export const revalidate = 21_600;

function dateText(date: { date: string; precision: string } | null) {
  return date ? date.date + " (" + date.precision.toLowerCase() + ")" : "Not reported";
}

function resultLabel(value: CagrilintideStudy["registryResults"]) {
  return value === "present" ? "Registry results section present"
    : value === "not-shown" ? "No registry results section returned"
      : "Results-section state unverified";
}

function StudyCard({ row }: { row: CagrilintideAuditRow }) {
  const isCombination = row.selection.scope === "combination-name";
  return (
    <article className="rounded-[20px] border border-[#111214]/20 bg-white p-5 sm:p-7">
      <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
        <span className={isCombination
          ? "rounded-full bg-[#fff1d6] px-3 py-1 text-[#775119]"
          : "rounded-full bg-[#e9f8ee] px-3 py-1 text-[#226342]"}>
          {isCombination ? "Combination-name example" : "Direct molecule-name example"}
        </span>
        <span className="font-mono text-[var(--muted)]">{row.selection.nctId}</span>
      </div>
      {!row.available ? (
        <>
          <h3 className="mt-5 text-xl font-extrabold">Official record unavailable</h3>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">The source could not be fetched or parsed. Its absence is not evidence about the study.</p>
          <a className="mt-3 inline-flex text-sm font-bold text-[#2b31d8] underline" href={"https://clinicaltrials.gov/study/" + row.selection.nctId} target="_blank" rel="noopener noreferrer">Open original registry record</a>
        </>
      ) : (
        <>
          <h3 className="mt-4 text-xl font-extrabold leading-7 tracking-[-.025em]">{row.study.title}</h3>
          <p className="mt-2 text-xs leading-6 text-[var(--muted)]">{row.selection.whySelected}</p>
          <a href={row.study.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-[#2b31d8] underline">
            Original ClinicalTrials.gov record <ArrowUpRight className="size-4" />
          </a>
          <div className="mt-5 grid gap-4 rounded-xl border border-[#111214]/10 bg-[#f7f7f4] p-4 sm:grid-cols-3">
            <div><p className="text-xs font-bold text-[var(--muted)]">Registered status</p><p className="mt-1 text-sm font-extrabold">{row.study.status?.replaceAll("_", " ") ?? "Unknown"}</p></div>
            <div><p className="text-xs font-bold text-[var(--muted)]">Registry results</p><p className="mt-1 text-sm font-extrabold">{resultLabel(row.study.registryResults)}</p></div>
            <div><p className="text-xs font-bold text-[var(--muted)]">First recorded primary outcome</p><p className="mt-1 text-xs font-semibold leading-6">{row.study.primaryOutcomes[0]?.measure ?? "Not available"}</p></div>
          </div>
          <details className="group mt-5 overflow-hidden rounded-xl border border-[#111214]/20">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-extrabold hover:bg-[#f7f7f4] [&::-webkit-details-marker]:hidden">
              Inspect study interventions, dates and registered outcomes
              <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-[#111214]/10 px-4 pb-5 sm:px-5">
              <dl className="mt-5 grid gap-x-7 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-xs text-[var(--muted)]">Registry status</dt><dd className="mt-1 text-sm font-extrabold">{row.study.status?.replaceAll("_", " ") ?? "Not reported"}</dd></div>
            <div><dt className="text-xs text-[var(--muted)]">Phase</dt><dd className="mt-1 text-sm font-extrabold">{row.study.phase?.replaceAll("PHASE", "Phase ") ?? "Not reported"}</dd></div>
            <div><dt className="text-xs text-[var(--muted)]">Enrollment</dt><dd className="mt-1 text-sm font-extrabold">{row.study.enrollment ? row.study.enrollment.count.toLocaleString("en-US") + " (" + row.study.enrollment.precision.toLowerCase() + ")" : "Not reported"}</dd></div>
            <div><dt className="text-xs text-[var(--muted)]">Primary completion</dt><dd className="mt-1 text-sm font-extrabold">{dateText(row.study.primaryCompletion)}</dd></div>
            <div className="lg:col-span-2"><dt className="text-xs text-[var(--muted)]">Sponsor</dt><dd className="mt-1 text-sm font-extrabold">{row.study.sponsor ?? "Not reported"}</dd></div>
            <div><dt className="text-xs text-[var(--muted)]">Results in registry</dt><dd className="mt-1 text-sm font-extrabold">{resultLabel(row.study.registryResults)}</dd></div>
            <div><dt className="text-xs text-[var(--muted)]">Record last updated</dt><dd className="mt-1 text-sm font-extrabold">{row.study.lastRegistryUpdate ?? "Not reported"}</dd></div>
          </dl>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl bg-[#f7f7f4] p-5">
              <h4 className="text-sm font-extrabold">Interventions actually named</h4>
              {row.study.interventions.length ? (
                <ul className="mt-3 list-inside list-disc space-y-1 text-xs leading-6 text-[var(--muted)]">
                  {row.study.interventions.map((name, i) => <li key={i}>{name}</li>)}
                </ul>
              ) : <p className="mt-3 text-xs text-[var(--muted)]">Not available in record.</p>}
              <p className="mt-3 text-xs leading-6 text-[var(--muted)]">Compound name match: {row.study.matchLocation.replaceAll("-", " ")}. This is not a verification of molecule composition or clinical benefit.</p>
            </section>
            <section className="rounded-xl bg-[#f7f7f4] p-5">
              <h4 className="text-sm font-extrabold">Primary outcomes registered</h4>
              {row.study.primaryOutcomes.length ? (
                <ul className="mt-3 space-y-3 text-xs leading-6 text-[var(--muted)]">
                  {row.study.primaryOutcomes.map((outcome, i) => (
                    <li key={i}><strong className="text-[#111214]">{outcome.measure}</strong><p>{outcome.timeFrame ? "Time frame: " + outcome.timeFrame : "Time frame not reported"}</p></li>
                  ))}
                </ul>
              ) : <p className="mt-3 text-xs text-[var(--muted)]">No parseable outcome measures returned.</p>}
              {row.study.primaryOutcomeCount > row.study.primaryOutcomes.length && (
                <p className="mt-3 text-xs">Additional primary outcomes exist; open the original registry to review all.</p>
              )}
            </section>
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

  return (
    <div className="pb-20">
      <section className="border-b-2 border-[#111214] bg-[#f0edff]">
        <div className="mx-auto max-w-[1120px] px-5 py-14 sm:px-8 sm:py-20">
          <Link href="/intelligence/cagrilintide" className="inline-flex items-center gap-2 text-xs font-bold text-[#2b31d8] hover:underline"><ArrowLeft className="size-4" /> Back to dossier</Link>
          <p className="mt-9 text-xs font-extrabold uppercase tracking-[.15em] text-[#2b31d8]">Source-audited research task · Prototype</p>
          <h1 className="mt-3 max-w-4xl text-balance text-[clamp(2.6rem,5.6vw,4.9rem)] font-extrabold leading-[1.03] tracking-[-.055em]">What can these cagrilintide trial records tell us?</h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-[#111214]/75">
            Instead of more search results, inspect a deliberately selected group of studies:
            which names appear in intervention fields, what each study planned to measure,
            whether registry results are present, and which questions remain unanswered.
          </p>
          <div className="mt-7"><ResearchAuditExport markdown={cagrilintideAuditMarkdown(audit)} /></div>
          <p className="mt-5 max-w-3xl text-xs leading-6 text-[var(--muted)]">
            These four records are not the entire clinical program. Assembled {audit.assembledAt}.
            Source responses can be cached for up to six hours; assembling an audit is not the same as fetching a new upstream version.
          </p>
        </div>
      </section>
      <div className="mx-auto max-w-[1120px] px-5 pt-11 sm:px-8">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[16px] border border-[#111214]/20 bg-white p-5">
            <p className="text-xs font-bold text-[var(--muted)]">Selected studies</p>
            <p className="mt-2 text-3xl font-extrabold">{counts.selected}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{counts.unavailable ? counts.unavailable + " source(s) unavailable" : "All selected sources available"}</p>
          </div>
          <div className="rounded-[16px] border border-[#111214]/20 bg-white p-5">
            <p className="text-xs font-bold text-[var(--muted)]">Direct-name examples with registry results</p>
            <p className="mt-2 text-3xl font-extrabold">{counts.directWithResultsSection}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Presence of a results section, not proof of benefit</p>
          </div>
          <div className="rounded-[16px] border border-[#111214]/20 bg-white p-5">
            <p className="text-xs font-bold text-[var(--muted)]">Direct-name examples without a registry results section</p>
            <p className="mt-2 text-3xl font-extrabold">{counts.directWithoutResultsSection}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Results could be available from other sources</p>
          </div>
        </div>

        {counts.directNameUnconfirmed > 0 && (
          <p role="status" className="mt-5 rounded-xl border border-[#a76512]/25 bg-[#fff9ed] p-4 text-sm">
            Some previously selected direct-name records do not currently match the molecule in the official intervention fields.
            Review those sources before drawing even preliminary conclusions.
          </p>
        )}

        <section aria-label="Source-audited review prompts" className="mt-12">
          <h2 className="text-2xl font-extrabold tracking-[-.04em]">What the records flag for follow-up</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">Each observation is traced to original records. These are factual source checks, not automated clinical judgments.</p>
          {insights.length ? (
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {insights.map(insight => (
                <article key={insight.heading} className="rounded-[16px] border border-[#111214]/20 bg-white p-5 sm:p-6">
                  <h3 className="text-base font-extrabold">{insight.heading}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#111214]">{insight.observation}</p>
                  <p className="mt-3 text-xs leading-6 text-[var(--muted)]">Why this needs care: {insight.interpretationLimit}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {insight.sources.map(source => (
                      <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#2b31d8] underline">
                        {source.title} <ArrowUpRight className="size-3" />
                      </a>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : <p className="mt-5 rounded-xl border border-[#111214]/15 bg-white p-5 text-sm">The current selection does not support a source-audited finding. Check unavailable records and original sources directly.</p>}
        </section>

        <div className="mt-12 flex items-start gap-3">
          <BookOpenCheck className="mt-1 size-5 shrink-0 text-[#2b31d8]" />
          <div><h2 className="text-2xl font-extrabold tracking-[-.035em]">Study-design audit</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
              A useful starting point for an analyst, not a head-to-head efficacy comparison.
              Study populations, doses, endpoints and designs can differ substantially.
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-5">{audit.rows.map(row => <StudyCard key={row.selection.nctId} row={row} />)}</div>
        <section className="mt-11 rounded-[20px] border border-[#111214]/20 bg-[#fff9ed] p-6 sm:p-8">
          <div className="flex items-start gap-3"><AlertTriangle className="mt-1 size-5 shrink-0 text-[#a76512]" />
            <div><h2 className="text-xl font-extrabold">Questions the current evidence cannot answer</h2>
              <ol className="mt-4 list-inside list-decimal space-y-3 text-sm leading-7 text-[#5d492d]">
                <li>Are other relevant cagrilintide studies missing from this deliberately selected sample?</li>
                <li>What primary-source evidence establishes the relationship between CagriSema and its component molecules?</li>
                <li>Are study populations and outcome definitions comparable enough to support any cross-study conclusion?</li>
                <li>Do publications contain evidence not visible in the official registry results sections?</li>
                <li>What changed since a prior date? No two verified historical versions have been captured for this feature.</li>
              </ol>
            </div>
          </div>
        </section>
        <section className="mt-7 flex items-start gap-3 rounded-[16px] border border-[#111214]/15 bg-white p-5">
          <GitCompareArrows className="mt-1 size-5 shrink-0 text-[#2b31d8]" />
          <p className="text-xs leading-6 text-[var(--muted)]">
            <strong className="text-[#111214]">What this prototype proves and what it does not.</strong>{" "}
            It turns official structured records into a task-based audit with inspectable sources.
            It does not reconcile trial results against papers, infer efficacy or establish regulatory status.
            A repeatable change report requires dated source snapshots. No personalized research profile is created.
          </p>
        </section>
      </div>
    </div>
  );
}

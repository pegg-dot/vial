import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, ChevronDown, FileCheck2 } from "lucide-react";
import { normalizeNctId } from "@/lib/nct-identifier";
import { lookupStudy, studySourceBrief, summarizeStudyEvidence } from "@/server/intelligence/study-lookup";
import { StudyLookupForm } from "@/components/intelligence/study-lookup-form";
import { StudyBriefActions } from "@/components/intelligence/study-brief-actions";
import { PEXIGANAN_TRIAL_SELECTION } from "@/lib/pexiganan-evidence-network";

export const metadata: Metadata = {
  title: "Check a clinical trial | VialGrade",
  description: "Check registry results and exact trial-to-publication relationships in original public sources.",
  robots: { index: false, follow: false },
};

function ExternalSource({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#5544a6] underline-offset-4 hover:underline">{children}<ArrowUpRight className="size-3.5 shrink-0" /></a>;
}

export default async function StudySourcePage({ params }: { params: Promise<{ nctId: string }> }) {
  const { nctId: raw } = await params;
  const id = normalizeNctId(raw);
  if (!id) notFound();
  const result = await lookupStudy(id);
  const connectedToPexiganan = PEXIGANAN_TRIAL_SELECTION.some(record => record.nctId === id);
  const card = "rounded-[18px] border border-[#dedee7] bg-white";

  if (result.state !== "available") return (
    <div className="mx-auto max-w-[980px] px-5 pb-24 pt-12 sm:px-8">
      <Link href="/intelligence" className="inline-flex items-center gap-2 text-sm font-semibold text-[#595284]"><ArrowLeft className="size-4" /> Back to study lookup</Link>
      <section className={card + " mt-9 p-7 sm:p-10"}>
        <h1 className="text-3xl font-semibold tracking-tight text-[#232333]">{result.state === "not-found" ? "Study not found" : "Registry temporarily unavailable"}</h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-[#676b78]">
          {result.state === "not-found"
            ? "ClinicalTrials.gov returned no record for " + id + ". Check the identifier or try another."
            : "We could not verify this registry response. That does not establish that the study or its papers are missing."}
        </p>
        <div className="mt-7 max-w-2xl"><StudyLookupForm initialId={id} compact /></div>
        <div className="mt-5"><ExternalSource href={"https://clinicaltrials.gov/study/" + id}>Check ClinicalTrials.gov directly</ExternalSource></div>
      </section>
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
    <div className="bg-[#faf9f7] pb-20">
      <div className="mx-auto max-w-[1080px] px-5 pt-9 sm:px-8">
        <Link href="/intelligence" className="inline-flex items-center gap-2 text-xs font-semibold text-[#595284] hover:underline"><ArrowLeft className="size-4" /> Back to study lookup</Link>
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#615899]">Study source check · {id}</p>
            <h1 className="mt-3 text-[clamp(2rem,4.5vw,3.4rem)] font-semibold tracking-[-.055em] text-[#222439]">Evidence for {id}</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[#555969]">{study.title}</p>
          </div>
          <div className={card + " hidden p-4 lg:block"}><StudyLookupForm compact initialId={id} /></div>
        </div>
        {connectedToPexiganan && (
          <section aria-label="Pexiganan evidence network link" className="mt-6 flex flex-col justify-between gap-3 rounded-xl border border-[#cee4d7] bg-[#ecf9f0] p-4 sm:flex-row sm:items-center sm:px-5">
            <div>
              <p className="text-xs font-extrabold text-[#286d55]">Connected to Pexiganan research</p>
              <p className="mt-1 text-xs leading-5 text-[#647a6a]">This is one of four curated registry records. The evidence passport shows its molecular, article and sponsor relationships without assuming clinical benefit.</p>
            </div>
            <Link href="/intelligence/passports/pexiganan" className="inline-flex min-h-10 shrink-0 items-center gap-1.5 text-xs font-extrabold text-[#25765f] hover:underline">
              Evidence passport <ArrowUpRight className="size-4" />
            </Link>
          </section>
        )}

        <section aria-labelledby="source-answer" className="mt-8 overflow-hidden rounded-[18px] border border-[#d5ccef] bg-[#f1edff]">
          <div className="px-6 py-7 sm:px-8">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#5c5195]">The short answer</p>
            <h2 id="source-answer" className="mt-3 max-w-4xl text-[clamp(1.45rem,2.6vw,2.1rem)] font-semibold leading-[1.3] tracking-[-.035em] text-[#26233e]">{summary.headline}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#56516b]">{summary.detail}</p>
          </div>
          <dl className="grid border-t border-[#d5ccef] bg-white/65 sm:grid-cols-3">
            <div className="border-b border-[#e5e2ee] px-6 py-4 sm:border-b-0 sm:border-r"><dt className="text-xs text-[#68677a]">Registry results</dt><dd className="mt-1 text-base font-semibold text-[#29293a]">{registryResult}</dd></div>
            <div className="border-b border-[#e5e2ee] px-6 py-4 sm:border-b-0 sm:border-r"><dt className="text-xs text-[#68677a]">PubMed links confirmed</dt><dd className="mt-1 text-base font-semibold text-[#29293a]">{summary.confirmedLinks} / {summary.linkedPapers} registry citations</dd></div>
            <div className="px-6 py-4"><dt className="text-xs text-[#68677a]">Study status</dt><dd className="mt-1 text-base font-semibold capitalize text-[#29293a]">{study.status?.replaceAll("_", " ").toLowerCase() ?? "Not reported"}</dd></div>
          </dl>
        </section>

        <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-5">
            <section aria-labelledby="evidence-links-title" className={card}>
              <div className="border-b border-[#ececf0] px-6 py-5">
                <h2 id="evidence-links-title" className="text-xl font-semibold text-[#292939]">Original sources</h2>
                <p className="mt-1 text-sm leading-6 text-[#6b6e79]">The study record, then papers explicitly listed by the registry. This is not a full literature search.</p>
              </div>
              <div className="flex gap-3 px-6 py-5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eeeafc] text-[#6559a1]"><FileCheck2 className="size-5" /></div>
                <div>
                  <h3 className="text-sm font-semibold text-[#292939]">ClinicalTrials.gov · {id}</h3>
                  <p className="mt-1 text-xs leading-6 text-[#727481]">Record updated {study.lastRegistryUpdate ?? "date not reported"}. Registry results {registryResult.toLowerCase()}.</p>
                  <div className="mt-2"><ExternalSource href={study.url}>Open registry record</ExternalSource></div>
                </div>
              </div>
              <div className="border-t border-[#ececf0] bg-[#fbfbfd] px-6 py-3 text-xs font-semibold text-[#5d6270]">Papers cited in this registry</div>
              {refPairs.length ? refPairs.map(({ reference, check }) => (
                <article key={reference.pmid} className="border-t border-[#ececf0] px-6 py-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-[#f0eefc] px-2 py-1 text-[11px] font-semibold text-[#5b4b9b]">Registry label · {reference.role}</span>
                    <span className="font-mono text-xs text-[#737685]">PMID {reference.pmid}</span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold leading-6 text-[#292939]">{check?.article?.title ?? reference.citation ?? "Publication metadata unavailable"}</h3>
                  {check?.article && <p className="mt-1 text-xs text-[#747783]">{check.article.journal ?? "Journal unknown"} · {check.article.publicationDate ?? "Date unknown"}</p>}
                  <p className="mt-2 text-sm leading-6 text-[#696d7c]">
                    {check?.secondaryIdMatch === "confirmed"
                      ? "PubMed independently indexes this publication under the same trial ID."
                      : check?.secondaryIdMatch === "not-corroborated"
                        ? "PubMed did not corroborate the exact trial ID. Review the original paper."
                        : "The PubMed check was unavailable. The registry citation is not an independently verified match."}
                  </p>
                  <div className="mt-3"><ExternalSource href={"https://pubmed.ncbi.nlm.nih.gov/" + reference.pmid + "/"}>Open PubMed record</ExternalSource></div>
                </article>
              )) : <p className="border-t border-[#ececf0] px-6 py-5 text-sm leading-6 text-[#6b6e79]">No PubMed IDs were listed in the checked registry fields. Papers may exist elsewhere.</p>}
            </section>

            <details className={card + " group overflow-hidden"}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-5 text-sm font-semibold text-[#292939] hover:bg-[#f9f9fd] [&::-webkit-details-marker]:hidden">
                Study design and registered outcomes <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-[#ececf0] px-6 py-5">
                <dl className="grid gap-5 sm:grid-cols-2">
                  <div><dt className="text-xs text-[#777987]">Sponsor</dt><dd className="mt-1 text-sm font-semibold">{study.sponsor ?? "Not reported"}</dd></div>
                  <div><dt className="text-xs text-[#777987]">Phase</dt><dd className="mt-1 text-sm font-semibold">{study.phase?.replaceAll("PHASE", "Phase ") ?? "Not reported"}</dd></div>
                  <div><dt className="text-xs text-[#777987]">Conditions</dt><dd className="mt-1 text-sm font-semibold">{study.population.conditions.join(", ") || "Not reported"}</dd></div>
                  <div><dt className="text-xs text-[#777987]">Enrollment</dt><dd className="mt-1 text-sm font-semibold">{study.enrollment ? study.enrollment.count.toLocaleString() + " (" + study.enrollment.precision.toLowerCase() + ")" : "Not reported"}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs text-[#777987]">Registered interventions</dt><dd className="mt-1 text-sm font-semibold">{study.interventions.join(", ") || "Not reported"}</dd></div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-[#777987]">First primary outcomes (up to three)</dt>
                    <dd className="mt-2">
                      {study.primaryOutcomes.length ? <ul className="list-inside list-disc space-y-1.5 text-sm leading-6">{study.primaryOutcomes.map((o, i) => <li key={i}>{o.measure}{o.timeFrame && <span className="text-[#747783]"> · {o.timeFrame}</span>}</li>)}</ul> : <span className="text-sm">Not reported</span>}
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 text-xs leading-5 text-[#777987]">Registry-provided study design, not a clinical outcome or dosing recommendation.</p>
              </div>
            </details>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-28">
            <section className={card + " p-6"}>
              <h2 className="text-sm font-semibold text-[#292939]">Take this research with you</h2>
              <p className="mt-2 text-sm leading-6 text-[#666977]">A brief containing the source links, checked relationships, and unresolved questions.</p>
              <div className="mt-5"><StudyBriefActions markdown={studySourceBrief(result)} nctId={id} /></div>
              <p className="mt-3 text-xs text-[#747783]">No account or saved research profile required.</p>
            </section>
            <section className={card + " p-6"}>
              <h2 className="text-sm font-semibold text-[#292939]">What to verify next</h2>
              <p className="mt-3 text-sm leading-7 text-[#666977]">{summary.nextQuestion}</p>
              <p className="mt-4 border-t border-[#ececf0] pt-4 text-xs leading-6 text-[#747783]">
                This only checks publication IDs explicitly cited by the registry. It does not assess study quality, effectiveness, reporting compliance or changes over time.
              </p>
            </section>
          </aside>
        </div>
        <p className="mt-8 max-w-4xl text-xs leading-6 text-[#747783]">
          Checked {result.checkedAt}. NIH responses may be cached for up to six hours. No research profile is created, though normal hosting logs may record a request. VialGrade provides no purchase or medical-advice features.
        </p>
      </div>
    </div>
  );
}

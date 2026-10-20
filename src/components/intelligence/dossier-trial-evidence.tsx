import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpenCheck, CheckCircle2, CircleHelp, FileText, ShieldAlert } from "lucide-react";
import type { ResearchSubject } from "@/lib/research-explorer";
import { dossierTrialEvidence, dossierTrialWorkpaper } from "@/lib/research-dossier-evidence";
import { lookupStudy } from "@/server/intelligence/study-lookup";
import { StudyBriefActions } from "@/components/intelligence/study-brief-actions";

export function TrialEvidenceLoading({ nctId }: { nctId: string }) {
  return (
    <section aria-label="Selected official trial evidence" className="rounded-2xl border border-[#dedee8] bg-white p-6 sm:p-7">
      <h2 className="text-base font-semibold text-[#28293b]">Checking the selected trial · {nctId}</h2>
      <p className="mt-3 text-sm leading-7 text-[#777b8b]">Loading its registered outcomes and publication relationships from official NIH sources. These links may be temporarily unavailable.</p>
    </section>
  );
}

function resultText(status: "present" | "not-shown" | "uncertain") {
  return status === "present" ? "Results section posted" :
    status === "not-shown" ? "No results section returned" : "Results section unverified";
}

function crosscheckText(result: "confirmed" | "not-corroborated" | "unavailable") {
  return result === "confirmed" ? "PubMed indexes exact NCT" :
    result === "not-corroborated" ? "NCT indexing not corroborated" :
      "Independent indexing unavailable";
}

export async function DossierTrialEvidence({ subject }: { subject: ResearchSubject }) {
  if (!subject.sampleTrial) return null;
  const lookup = await lookupStudy(subject.sampleTrial);
  const card = dossierTrialEvidence(subject, lookup);

  if (card.state !== "verified") return (
    <section id="evidence-review" aria-label="Selected official trial evidence" className="rounded-2xl border border-[#e4d5bf] bg-[#fffaf0] p-6 sm:p-7">
      <div className="flex items-center gap-2 text-[#9b6b22]"><ShieldAlert className="size-4" /><span className="text-xs font-bold uppercase tracking-[.1em]">Source status · Needs verification</span></div>
      <h2 className="mt-3 text-lg font-semibold text-[#3b3544]">The selected trial could not be verified.</h2>
      <p className="mt-3 text-sm leading-7 text-[#706a6a]">
        {card.state === "identity-not-verified"
          ? "The fetched study did not reliably match this subject in its intervention fields. We are not treating it as supporting evidence."
          : "The registry record was unavailable or incomplete during this check. This does not mean the trial or its publications do not exist."}
      </p>
      <a href={card.registryUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#6d4b9d] underline">
        Open {card.nctId} at ClinicalTrials.gov <ArrowUpRight className="size-4" />
      </a>
    </section>
  );

  return (
    <section id="evidence-review" aria-label="Selected official trial evidence" className="overflow-hidden rounded-2xl border border-[#d8d3ec] bg-white">
      <div className="border-b border-[#e7e3f1] bg-[#f4f1fe] px-6 py-6 sm:px-7">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[.1em] text-[#67549e]">
          <CheckCircle2 className="size-4" /> Official source check · {card.nctId}
        </div>
        <h2 className="mt-3 text-xl font-semibold tracking-[-.035em] text-[#2a2942]">What the selected trial actually records</h2>
        <p className="mt-2 text-sm leading-6 text-[#626079]">
          This is one verified intervention-name match, not every study of {subject.name}. It gives you original registry facts and exact PubMed citation relationships, not a conclusion about clinical benefit.
        </p>
      </div>

      <dl className="grid gap-0 border-b border-[#eae8ef] sm:grid-cols-3">
        <div className="border-b border-[#eae8ef] px-6 py-4 sm:border-b-0 sm:border-r">
          <dt className="text-xs text-[#80808b]">Official study status</dt>
          <dd className="mt-1 text-sm font-semibold capitalize text-[#323147]">{card.status?.toLowerCase().replaceAll("_", " ") ?? "Not reported"}</dd>
        </div>
        <div className="border-b border-[#eae8ef] px-6 py-4 sm:border-b-0 sm:border-r">
          <dt className="text-xs text-[#80808b]">Registry result reporting</dt>
          <dd className="mt-1 text-sm font-semibold text-[#323147]">{resultText(card.hasRegistryResults)}</dd>
        </div>
        <div className="px-6 py-4">
          <dt className="text-xs text-[#80808b]">Exact PubMed NCT links</dt>
          <dd className="mt-1 text-sm font-semibold text-[#323147]">
            {card.confirmedPubmedLinks} / {card.citations.length} cited PubMed IDs
          </dd>
        </div>
      </dl>

      <div className="space-y-5 px-6 py-6 sm:px-7">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.1em] text-[#898394]">The trial&apos;s registered question</p>
          <h3 className="mt-1.5 text-base font-semibold leading-6 text-[#2e3043]">{card.studyTitle}</h3>
          <p className="mt-3 text-sm leading-6 text-[#676d79]">
            Registered primary outcome{card.totalOutcomeMeasures === 1 ? "" : "s"}:
          </p>
          {card.outcomeMeasures.length ? (
            <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm leading-6 text-[#404458]">
              {card.outcomeMeasures.map((measure, i) => <li key={i}>{measure}</li>)}
            </ul>
          ) : <p className="mt-2 text-sm text-[#868891]">No parseable primary outcome measure returned.</p>}
          {card.totalOutcomeMeasures > card.outcomeMeasures.length && <p className="mt-2 text-xs text-[#858593]">More outcome measures appear in the registry; open the original source to review all.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#edeaf0] pt-4 text-xs text-[#737786]">
          <span>Phase: {card.phase?.replaceAll("PHASE", "Phase ") ?? "Not reported"}</span>
          <span>Sponsor: {card.sponsor ?? "Not reported"}</span>
          <span>Registry update: {card.recordUpdatedAt ?? "Unknown"}</span>
          {card.enrollment && <span>Enrollment: {card.enrollment.count.toLocaleString("en-US")} ({card.enrollment.kind.toLowerCase()})</span>}
        </div>

        <div className="border-t border-[#edeaf0] pt-4">
          <div className="flex items-center gap-2">
            <BookOpenCheck className="size-4 text-[#6c5d9e]" />
            <h3 className="text-sm font-semibold text-[#323148]">Papers specifically cited by this registry</h3>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-[#797d89]">
            The registry assigns each paper a role such as RESULT, BACKGROUND or DERIVED. PubMed may independently list the same trial ID. Neither verifies the article&apos;s conclusions.
          </p>
          {card.citations.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {card.citations.map(ref => (
                <li key={ref.pmid} className="rounded-xl border border-[#e8e7ee] bg-[#fcfbfe] p-4">
                  <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-[#696782]">
                    <span className="rounded-md bg-[#eeebfa] px-2 py-1">Registry: {ref.registryRole}</span>
                    <span className="rounded-md bg-[#f0f1f5] px-2 py-1">{crosscheckText(ref.exactNct)}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#313248]">{ref.pubmedTitle ?? "Article metadata not independently available"}</p>
                  <a href={ref.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#594b9b] hover:underline">
                    PMID {ref.pmid} · Open original PubMed record <ArrowUpRight className="size-3" />
                  </a>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm leading-6 text-[#6e7280]">No PMID is in the inspected registry reference fields. This does not mean no paper exists.</p>}
        </div>
        <div className="rounded-xl bg-[#f7f7fa] p-4">
          <div className="flex gap-2"><CircleHelp className="mt-0.5 size-4 shrink-0 text-[#786f9e]" /><p className="text-sm font-semibold text-[#3f3a58]">What this cannot establish</p></div>
          <p className="mt-2 text-xs leading-6 text-[#676b7a]">
            Registration, result-section availability and publication indexing are separate facts. This check has not evaluated clinical effectiveness, published outcome statistics, reporting compliance, all available literature or comparisons against another study.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#edeaf0] pt-5">
          <div>
            <p className="text-xs font-semibold text-[#343247]">Take the source workpaper</p>
            <p className="mt-1 text-xs leading-5 text-[#838694]">Includes original links and explicit uncertainty. No account required.</p>
          </div>
          <StudyBriefActions nctId={card.nctId} markdown={dossierTrialWorkpaper(card)} />
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
          <a href={card.registryUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#55479c] hover:underline">
            <FileText className="size-3.5" /> Read the registry <ArrowUpRight className="size-3" />
          </a>
          <Link href={"/intelligence/studies/" + card.nctId} className="inline-flex items-center gap-1 text-[#55479c] hover:underline">
            Full NCT evidence check <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <p className="text-[11px] leading-5 text-[#8c8e99]">
          Retrieved {card.checkedAt.slice(0, 16).replace("T", " ")} UTC. Source API responses may be cached for up to six hours. No individual research-history profile is created.
        </p>
      </div>
    </section>
  );
}

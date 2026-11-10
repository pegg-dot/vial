import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpenCheck, CheckCircle2, CircleHelp, FileText, ShieldAlert } from "lucide-react";
import type { ResearchSubject } from "@/lib/research-explorer";
import { dossierTrialEvidence, dossierTrialWorkpaper } from "@/lib/research-dossier-evidence";
import { lookupStudy } from "@/server/intelligence/study-lookup";
import { StudyBriefActions } from "@/components/intelligence/study-brief-actions";
import { Chip, Notice, Quiet, UI, type Tone } from "@/components/intelligence/research-ui";

// The heading that names an inner panel inside a dossier frame: ink, display weight, under the frame's h2.
const PANEL_H3 = "text-lg font-extrabold tracking-[-.03em] text-[#111214]";

export function TrialEvidenceLoading({ nctId }: { nctId: string }) {
  return (
    <Quiet as="section" ariaLabel="Selected official trial evidence">
      <h3 className={UI.h4}>Checking the selected trial · {nctId}</h3>
      <p className={UI.body + " mt-2"}>Loading its registered outcomes and publication relationships from official NIH sources. These links may be temporarily unavailable.</p>
    </Quiet>
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

// Tone says what kind of fact the cross-check is: corroborated (mint), contradicted (warn), unknown (paper).
const CROSSCHECK_TONE: Record<"confirmed" | "not-corroborated" | "unavailable", Tone> = {
  confirmed: "mint", "not-corroborated": "warn", unavailable: "paper",
};

export async function DossierTrialEvidence({ subject }: { subject: ResearchSubject }) {
  if (!subject.sampleTrial) return null;
  const lookup = await lookupStudy(subject.sampleTrial);
  const card = dossierTrialEvidence(subject, lookup);

  if (card.state !== "verified") return (
    <section id="evidence-review" aria-label="Selected official trial evidence" className="ink-1 rounded-[14px] bg-[#fff3d8] p-5">
      <Chip tone="warn" icon={ShieldAlert}>Source status · Needs verification</Chip>
      <h3 className={PANEL_H3 + " mt-3"}>The selected trial could not be verified.</h3>
      <p className={UI.bodyInk + " mt-2 leading-7"}>
        {card.state === "identity-not-verified"
          ? "The fetched study did not reliably match this subject in its intervention fields. We are not treating it as supporting evidence."
          : "The registry record was unavailable or incomplete during this check. This does not mean the trial or its publications do not exist."}
      </p>
      <a href={card.registryUrl} target="_blank" rel="noopener noreferrer" className={UI.link + " mt-4"}>
        Open {card.nctId} at ClinicalTrials.gov <ArrowUpRight className="size-4" aria-hidden="true" />
      </a>
    </section>
  );

  return (
    <section id="evidence-review" aria-label="Selected official trial evidence" className="overflow-hidden rounded-[14px] border border-[#111214]/15 bg-white">
      <div className="border-b border-[#111214]/15 bg-[#eef0ff] px-5 py-4">
        <p className={UI.eyebrow + " flex flex-wrap items-center gap-2"}>
          <CheckCircle2 className="size-4" aria-hidden="true" /> Official source check · {card.nctId}
        </p>
        <h3 className={PANEL_H3 + " mt-2"}>What the selected trial actually records</h3>
        <p className={UI.bodyInk + " mt-2"}>
          This is one verified intervention-name match, not every study of {subject.name}. It gives you original registry facts and exact PubMed citation relationships, not a conclusion about clinical benefit.
        </p>
      </div>

      <dl className="grid gap-0 border-b border-[#111214]/15 sm:grid-cols-3">
        <div className="border-b border-[#111214]/15 px-5 py-3 sm:border-b-0 sm:border-r">
          <dt className={UI.eyebrowMuted}>Official study status</dt>
          <dd className="mt-1 text-sm font-bold capitalize text-[#111214]">{card.status?.toLowerCase().replaceAll("_", " ") ?? "Not reported"}</dd>
        </div>
        <div className="border-b border-[#111214]/15 px-5 py-3 sm:border-b-0 sm:border-r">
          <dt className={UI.eyebrowMuted}>Registry result reporting</dt>
          <dd className="mt-1 text-sm font-bold text-[#111214]">{resultText(card.hasRegistryResults)}</dd>
        </div>
        <div className="px-5 py-3">
          <dt className={UI.eyebrowMuted}>Exact PubMed NCT links</dt>
          <dd className="mt-1 text-sm font-bold text-[#111214]">
            {card.confirmedPubmedLinks} / {card.citations.length} cited PubMed IDs
          </dd>
        </div>
      </dl>

      <div className="grid gap-5 px-5 py-5 lg:grid-cols-2">
        <div className="min-w-0 space-y-4">
        <div>
          <p className={UI.eyebrowMuted}>The trial&apos;s registered question</p>
          <h3 className={UI.h4 + " mt-1.5 leading-6"}>{card.studyTitle}</h3>
          <p className={UI.bodyInk + " mt-3"}>
            Registered primary outcome{card.totalOutcomeMeasures === 1 ? "" : "s"}:
          </p>
          {card.outcomeMeasures.length ? (
            <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm font-medium leading-6 text-[#3a3d46]">
              {card.outcomeMeasures.map((measure, i) => <li key={i}>{measure}</li>)}
            </ul>
          ) : <p className={UI.body + " mt-2"}>No parseable primary outcome measure returned.</p>}
          {card.totalOutcomeMeasures > card.outcomeMeasures.length && <p className={UI.small + " mt-2"}>More outcome measures appear in the registry; open the original source to review all.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#111214]/15 pt-4 text-xs font-medium text-[var(--muted)]">
          <span>Phase: {card.phase?.replaceAll("PHASE", "Phase ") ?? "Not reported"}</span>
          <span>Sponsor: {card.sponsor ?? "Not reported"}</span>
          <span>Registry update: {card.recordUpdatedAt ?? "Unknown"}</span>
          {card.enrollment && <span>Enrollment: {card.enrollment.count.toLocaleString("en-US")} ({card.enrollment.kind.toLowerCase()})</span>}
        </div>

        </div>
        <div className="min-w-0 space-y-4">
        <Notice tone="warn" icon={CircleHelp} title="What this cannot establish">
          <p className="text-xs leading-6">
            Registration, result-section availability and publication indexing are separate facts. This check has not evaluated clinical effectiveness, published outcome statistics, reporting compliance, all available literature or comparisons against another study.
          </p>
        </Notice>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#111214]/15 pt-5">
          <div>
            <p className="text-xs font-extrabold text-[#111214]">Take the source workpaper</p>
            <p className={UI.small + " mt-1"}>Includes original links and explicit uncertainty. No account required.</p>
          </div>
          <StudyBriefActions nctId={card.nctId} markdown={dossierTrialWorkpaper(card)} />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <a href={card.registryUrl} target="_blank" rel="noopener noreferrer" className={UI.linkSmall}>
            <FileText className="size-3.5" aria-hidden="true" /> Read the registry <ArrowUpRight className="size-3" aria-hidden="true" />
          </a>
          <Link href={"/intelligence/studies/" + card.nctId} className={UI.linkSmall}>
            Full NCT evidence check <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
        <p className="text-[11px] font-medium leading-5 text-[var(--muted)]">
          Retrieved {card.checkedAt.slice(0, 16).replace("T", " ")} UTC. Source API responses may be cached for up to six hours. No individual research-history profile is created.
        </p>
        </div>
        <div className="border-t border-[#111214]/15 pt-4 lg:col-span-2">
          <div className="flex items-center gap-2">
            <BookOpenCheck className="size-4 text-[#2b31d8]" aria-hidden="true" />
            <h3 className={UI.h4}>Papers specifically cited by this registry</h3>
          </div>
          <p className={UI.small + " mt-1.5"}>
            The registry assigns each paper a role such as RESULT, BACKGROUND or DERIVED. PubMed may independently list the same trial ID. Neither verifies the article&apos;s conclusions.
          </p>
          {card.citations.length > 0 ? (
            (() => {
              const head = card.citations.slice(0, 4);
              const rest = card.citations.slice(4);
              const row = (ref: (typeof card.citations)[number]) => (
                <Quiet as="li" key={ref.pmid}>
                  <div className="flex flex-wrap gap-1.5">
                    <Chip tone="blue">Registry: {ref.registryRole}</Chip>
                    <Chip tone={CROSSCHECK_TONE[ref.exactNct]}>{crosscheckText(ref.exactNct)}</Chip>
                  </div>
                  <p className="mt-2 text-[13px] font-extrabold leading-5 text-[#111214]">{ref.pubmedTitle ?? "Article metadata not independently available"}</p>
                  <a href={ref.url} target="_blank" rel="noopener noreferrer" className={UI.linkSmall + " mt-1.5"}>
                    PMID {ref.pmid} · Open original PubMed record <ArrowUpRight className="size-3" aria-hidden="true" />
                  </a>
                </Quiet>
              );
              return (
                <>
                  <ul className="mt-3 grid gap-2.5 md:grid-cols-2">{head.map(row)}</ul>
                  {rest.length > 0 && (
                    <details className="mt-2.5">
                      <summary className="inline-flex min-h-6 cursor-pointer items-center text-xs font-extrabold text-[#2b31d8]">Show {rest.length} more cited papers</summary>
                      <ul className="mt-2.5 grid gap-2.5 md:grid-cols-2">{rest.map(row)}</ul>
                    </details>
                  )}
                </>
              );
            })()
          ) : <p className={UI.body + " mt-3"}>No PMID is in the inspected registry reference fields. This does not mean no paper exists.</p>}
        </div>
      </div>
    </section>
  );
}

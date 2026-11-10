import Link from "next/link";
import { ArrowRight, ArrowUpRight, FileText } from "lucide-react";
import type { ResearchSubject } from "@/lib/research-explorer";
import { dossierTrialEvidence } from "@/lib/research-dossier-evidence";
import { lookupStudy } from "@/server/intelligence/study-lookup";
import { Frame, Quiet, TONE_ACCENT, UI } from "@/components/intelligence/research-ui";

/** One selected registry record, not a matched head-to-head comparison. */
export async function CompareTrialSource({ subject }: { subject: ResearchSubject }) {
  const label = subject.name + " selected trial source";
  if (!subject.sampleTrial) return (
    <Quiet as="section" ariaLabel={label}>
      <p className={UI.eyebrowMuted}>Selected trial example</p>
      <p className={UI.small + " mt-2 leading-6"}>No trial has yet been individually verified and pinned to this research dossier. That is not evidence that clinical studies do not exist.</p>
    </Quiet>
  );

  const result = await lookupStudy(subject.sampleTrial);
  const card = dossierTrialEvidence(subject, result);
  if (card.state !== "verified") return (
    <Frame as="section" tone="warn" shadow="none" thin radius="rounded-[14px]" pad="sm" ariaLabel={label}>
      <p className={"text-[11px] font-extrabold uppercase tracking-[.12em] " + TONE_ACCENT.warn}>Registry verification unavailable</p>
      <p className="mt-2 text-xs font-medium leading-6 text-[#111214]">Could not currently confirm {card.nctId} and its intervention identity. Do not use it as a verified comparison point.</p>
      <a href={card.registryUrl} target="_blank" rel="noopener noreferrer" className={UI.linkSmall + " mt-2"}>Open original study <ArrowUpRight className="size-3" aria-hidden="true" /></a>
    </Frame>
  );

  // Recorded registry facts read as a mint snapshot, the same tint the dossier uses for them.
  const rows: readonly [string, string][] = [
    ["Registered phase", card.phase?.replaceAll("PHASE", "Phase ") ?? "Not reported"],
    ["Registry results", card.hasRegistryResults === "present" ? "Posted" : card.hasRegistryResults === "not-shown" ? "Not posted in record" : "Unverified"],
    ["Exact NCT-PubMed links", card.confirmedPubmedLinks + " / " + card.citations.length + " registry PMIDs"],
  ];
  return (
    <Frame as="section" tone="mint" shadow="none" thin radius="rounded-[14px]" pad="sm" ariaLabel={label}>
      <p className={"flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[.12em] " + TONE_ACCENT.mint}>
        <FileText className="size-3.5" aria-hidden="true" /> Selected trial · {card.nctId}
      </p>
      <p className="mt-2 text-xs font-bold leading-6 text-[#111214]">{card.studyTitle}</p>
      <dl className="mt-3 space-y-2 text-xs">
        {rows.map(([term, detail]) => (
          <div key={term} className="flex justify-between gap-3">
            <dt className="font-medium text-[#4a4d56]">{term}</dt>
            <dd className="max-w-[65%] text-right font-extrabold text-[#111214]">{detail}</dd>
          </div>
        ))}
      </dl>
      <Link href={"/intelligence/studies/" + card.nctId} className={UI.linkSmall + " mt-3"}>Review original source check <ArrowRight className="size-3.5" aria-hidden="true" /></Link>
    </Frame>
  );
}

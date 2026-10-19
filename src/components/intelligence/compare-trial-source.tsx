import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import type { ResearchSubject } from "@/lib/research-explorer";
import { dossierTrialEvidence } from "@/lib/research-dossier-evidence";
import { lookupStudy } from "@/server/intelligence/study-lookup";

/** One selected registry record, not a matched head-to-head comparison. */
export async function CompareTrialSource({ subject }: { subject: ResearchSubject }) {
  if (!subject.sampleTrial) return (
    <section aria-label={subject.name + " selected trial source"} className="mt-5 rounded-xl border border-[#e4e4ed] bg-[#fbfbfc] p-4">
      <p className="text-[11px] font-bold uppercase tracking-[.09em] text-[#827c97]">Selected trial example</p>
      <p className="mt-2 text-xs leading-6 text-[#757787]">No trial has yet been individually verified and pinned to this research dossier. That is not evidence that clinical studies do not exist.</p>
    </section>
  );

  const result = await lookupStudy(subject.sampleTrial);
  const card = dossierTrialEvidence(subject, result);
  if (card.state !== "verified") return (
    <section aria-label={subject.name + " selected trial source"} className="mt-5 rounded-xl border border-[#e6dabb] bg-[#fffaf0] p-4">
      <p className="text-[11px] font-bold uppercase tracking-[.09em] text-[#9a733a]">Registry verification unavailable</p>
      <p className="mt-2 text-xs leading-6 text-[#756d60]">Could not currently confirm {card.nctId} and its intervention identity. Do not use it as a verified comparison point.</p>
      <a href={card.registryUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-xs font-semibold text-[#635099] underline">Open original study</a>
    </section>
  );

  return (
    <section aria-label={subject.name + " selected trial source"} className="mt-5 rounded-xl border border-[#d8d9e9] bg-[#f8f7fd] p-4">
      <div className="flex items-center gap-1.5"><FileText className="size-3.5 text-[#695f9b]" /><p className="text-[11px] font-bold uppercase tracking-[.09em] text-[#685b9a]">Selected trial · {card.nctId}</p></div>
      <p className="mt-2 text-xs leading-6 text-[#4b5063]">{card.studyTitle}</p>
      <dl className="mt-3 space-y-2 text-xs">
        <div className="flex justify-between gap-3"><dt className="text-[#7a7b89]">Registered phase</dt><dd className="max-w-[65%] text-right font-semibold text-[#35374b]">{card.phase?.replaceAll("PHASE", "Phase ") ?? "Not reported"}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-[#7a7b89]">Registry results</dt><dd className="max-w-[65%] text-right font-semibold text-[#35374b]">{card.hasRegistryResults === "present" ? "Posted" : card.hasRegistryResults === "not-shown" ? "Not posted in record" : "Unverified"}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-[#7a7b89]">Exact NCT-PubMed links</dt><dd className="max-w-[65%] text-right font-semibold text-[#35374b]">{card.confirmedPubmedLinks} / {card.citations.length} registry PMIDs</dd></div>
      </dl>
      <Link href={"/intelligence/studies/" + card.nctId} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#5c4c9e] hover:underline">Review original source check <ArrowRight className="size-3.5" /></Link>
    </section>
  );
}

import { ArrowUpRight, Building2 } from "lucide-react";
import type { ResearchSubject } from "@/lib/research-explorer";
import { ORGANIZATIONS_LIMITATION, organizationsForSubject } from "@/lib/research-organizations";
import { lookupStudy } from "@/server/intelligence/study-lookup";

const REASON_TEXT = {
  "not-checked": "The registry record has not been read for this view.",
  "not-reported": "The registry record does not name a lead sponsor.",
  unverified: "The registry record could not be matched to this compound on this check, so no organization is shown. This does not mean the study or its sponsor do not exist.",
} as const;

export function OrganizationsLoading() {
  return (
    <section aria-label="Organizations on record" className="rounded-2xl border border-[#dedee8] bg-white p-6">
      <h2 className="text-base font-semibold text-[#292b3c]">Organizations on record</h2>
      <p className="mt-3 text-sm leading-7 text-[#656a78]">Reading the registry record.</p>
    </section>
  );
}

export async function DossierOrganizations({ subject }: { subject: ResearchSubject }) {
  const lookup = subject.slug !== "pexiganan" && subject.sampleTrial ? await lookupStudy(subject.sampleTrial) : null;
  const view = organizationsForSubject(subject, lookup);
  return (
    <section id="organizations" aria-labelledby="dossier-organizations-title" className="scroll-mt-40 overflow-hidden rounded-2xl border border-[#dedee8] bg-white">
      <div className="border-b border-[#ececf1] px-6 py-5">
        <div className="flex items-center gap-2 text-[#685b9a]"><Building2 className="size-4" aria-hidden="true" /><p className="text-xs font-bold uppercase tracking-[.12em]">Who is on record</p></div>
        <h2 id="dossier-organizations-title" className="mt-2 text-xl font-semibold tracking-[-.035em] text-[#28293b]">Organizations on record</h2>
        <p className="mt-2 text-sm leading-6 text-[#727684]">Each row names an organization a public registry record lists as lead sponsor, with the record it came from.</p>
      </div>
      {view.rows.length > 0 && (
        <ul className="divide-y divide-[#ececf1]">
          {view.rows.map(row => (
            <li key={row.key} className="flex items-start justify-between gap-4 px-6 py-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#303145]">{row.organization}</p>
                <p className="mt-1 text-xs leading-5 text-[#777b88]">{row.role} · {row.studyId}</p>
                <p className="text-xs leading-5 text-[#777b88]">{row.basis}</p>
              </div>
              <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-6 shrink-0 items-center gap-1 text-xs font-bold text-[#2b31d8] underline underline-offset-4">
                {row.sourceLabel} <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {view.rows.length === 0 && (
        <div className="px-6 py-5 text-sm leading-7 text-[#656a78]">
          {view.unconfirmed ? (
            <>
              <p>{REASON_TEXT[view.unconfirmed.reason]}</p>
              <a href={view.unconfirmed.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-6 items-center gap-1 text-xs font-bold text-[#2b31d8] underline underline-offset-4">
                Open {view.unconfirmed.studyId} at ClinicalTrials.gov <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </a>
            </>
          ) : (
            <p>No registered study is on file for this compound yet, so no organization is listed.</p>
          )}
        </div>
      )}
      <p className="border-t border-[#ececf1] bg-[#faf9f7] px-6 py-4 text-xs leading-6 text-[#727684]">
        {ORGANIZATIONS_LIMITATION} Originator and patent-holder records are not part of this file yet.
      </p>
    </section>
  );
}

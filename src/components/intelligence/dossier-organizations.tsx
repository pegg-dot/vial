import { ArrowUpRight, Building2 } from "lucide-react";
import type { ResearchSubject } from "@/lib/research-explorer";
import { ORGANIZATIONS_LIMITATION, organizationsForSubject } from "@/lib/research-organizations";
import { lookupStudy } from "@/server/intelligence/study-lookup";
import { Quiet, UI } from "@/components/intelligence/research-ui";

// The heading that names an inner panel inside a dossier frame: ink, display weight, under the frame's h2.
const PANEL_H3 = "text-lg font-extrabold tracking-[-.03em] text-[#111214]";

const REASON_TEXT = {
  "not-checked": "The registry record has not been read for this view.",
  "not-reported": "The registry record does not name a lead sponsor.",
  unverified: "The registry record could not be matched to this compound on this check, so no organization is shown. This does not mean the study or its sponsor do not exist.",
} as const;

export function OrganizationsLoading() {
  return (
    <Quiet as="section" ariaLabel="Organizations on record">
      <h3 className={UI.h4}>Organizations on record</h3>
      <p className={UI.body + " mt-2"}>Reading the registry record.</p>
    </Quiet>
  );
}

export async function DossierOrganizations({ subject }: { subject: ResearchSubject }) {
  const lookup = subject.slug !== "pexiganan" && subject.sampleTrial ? await lookupStudy(subject.sampleTrial) : null;
  const view = organizationsForSubject(subject, lookup);
  return (
    <section id="organizations" aria-labelledby="dossier-organizations-title" className="scroll-mt-40 overflow-hidden rounded-[14px] border border-[#111214]/15 bg-white">
      <div className="border-b border-[#111214]/15 px-5 py-4">
        <p className={UI.eyebrow + " flex items-center gap-2"}><Building2 className="size-4" aria-hidden="true" /> Who is on record</p>
        <h3 id="dossier-organizations-title" className={PANEL_H3 + " mt-2"}>Organizations on record</h3>
        <p className={UI.bodyInk + " mt-2"}>Each row names an organization a public registry record lists as lead sponsor, with the record it came from.</p>
      </div>
      {view.rows.length > 0 && (
        <ul className="divide-y divide-[#111214]/10">
          {view.rows.map(row => (
            <li key={row.key} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-[#111214]">{row.organization}</p>
                <p className={UI.small + " mt-1"}>{row.role} · {row.studyId}</p>
                <p className={UI.small}>{row.basis}</p>
              </div>
              <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" className={UI.linkSmall + " shrink-0"}>
                {row.sourceLabel} <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {view.rows.length === 0 && (
        <div className={UI.body + " px-5 py-5 leading-7"}>
          {view.unconfirmed ? (
            <>
              <p>{REASON_TEXT[view.unconfirmed.reason]}</p>
              <a href={view.unconfirmed.sourceUrl} target="_blank" rel="noopener noreferrer" className={UI.linkSmall + " mt-2"}>
                Open {view.unconfirmed.studyId} at ClinicalTrials.gov <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </a>
            </>
          ) : (
            <p>No registered study is on file for this compound yet, so no organization is listed.</p>
          )}
        </div>
      )}
      <p className="border-t border-[#111214]/15 bg-[var(--background)] px-5 py-4 text-xs font-medium leading-6 text-[var(--muted)]">
        {ORGANIZATIONS_LIMITATION} Originator and patent-holder records are not part of this file yet.
      </p>
    </section>
  );
}

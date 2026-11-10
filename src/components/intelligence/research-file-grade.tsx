import Link from "next/link";
import { ArrowUpRight, CircleAlert, CircleDashed, FileCheck2, Files, SearchCheck } from "lucide-react";
import { gradeResearchFile, FILE_GRADE_LIMITS, type FileCheckState } from "@/lib/research-file-grade";
import type { ResearchSubject } from "@/lib/research-explorer";
import { TONE_ACCENT, UI } from "@/components/intelligence/research-ui";

const STATE_TEXT: Record<FileCheckState, string> = {
  linked: "Source linked",
  qualified: "Identity qualified",
  "not-reviewed": "Not individually reviewed",
};

const SYMBOL = {
  linked: FileCheck2,
  qualified: CircleAlert,
  "not-reviewed": CircleDashed,
} as const;

// Tone says what kind of fact a check state is: linked (mint), qualified (amber), not reviewed (muted ink).
const STATE_CLASS: Record<FileCheckState, string> = {
  linked: TONE_ACCENT.mint,
  qualified: TONE_ACCENT.warn,
  "not-reviewed": "text-[#4a4d56]",
};

/** This badge only describes our curated FILE, not the named peptide. */
export function ResearchFileGradeMark({ subject, withCount = false }: {
  subject: ResearchSubject;
  withCount?: boolean;
}) {
  const file = gradeResearchFile(subject);
  return (
    <span
      className="ink-1 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold text-[#111214]"
      aria-label={"VialGrade research file coverage " + (file.letter ?? "ungraded") + ", " + file.linkedCount + " of 3 source layers linked"}
      title={"Research file only: " + file.headline + ". Not peptide quality or efficacy."}
    >
      <span className="grid size-5 place-items-center rounded-[4px] bg-[#111214] text-[11px] font-black text-white" aria-hidden="true">
        {file.letter ?? "?"}
      </span>
      File coverage {file.letter ?? "ungraded"}
      {withCount && <span className="font-semibold text-[var(--muted)]">· {file.linkedCount}/3</span>}
    </span>
  );
}

/** Reuses original VialGrade's decomposed grade pattern but deliberately
 * removes the vendor trust, purity and product scores. */
export function ResearchFileGradeCard({ subject, compact = false, bare = false }: {
  subject: ResearchSubject;
  compact?: boolean;
  /** Drop the card's own frame when it already sits inside a framed section. */
  bare?: boolean;
}) {
  const file = gradeResearchFile(subject);
  return (
    <section aria-label={"Research file grade for " + subject.name}
      className={bare ? "bg-white" : "overflow-hidden rounded-[14px] border border-[#111214]/15 bg-white " + (compact ? "p-4" : "p-5 sm:p-6")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={UI.eyebrow + " flex items-center gap-1.5"}>
          <SearchCheck className="size-4" aria-hidden="true" /> VialGrade research file
        </p>
        <Link href="/intelligence/grading" className={UI.linkSmall}>How grading works</Link>
      </div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[clamp(1.7rem,3vw,2.4rem)] font-extrabold leading-none tracking-[-.05em] text-[#111214]">{file.linkedCount}<span className="text-xl text-[var(--muted)]">/3</span></p>
          <h3 className={UI.h4 + " mt-2"}>
            {file.linkedCount === 1 ? "Research source type linked" : "Research source types linked"}
          </h3>
          <p className={UI.bodyInk + " mt-1"}>{file.headline}</p>
          <p className="mt-2 text-xs font-bold leading-5 text-[var(--muted)]">
            {file.letter ? "File coverage " + file.letter : "No file grade yet"} · {file.linkedCount} of 3 source layers individually linked in this starter file
          </p>
        </div>
        <span className="ink hard-sm flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-[#111214] text-xl font-black text-white"
          aria-label={"File grade " + (file.letter ?? "not assigned")}>
          {file.letter ?? "—"}
        </span>
      </div>

      <div className={"mt-5 divide-y divide-[#111214]/10 rounded-[14px] border border-[#111214]/15 bg-[#fbfbf8] " + (compact ? "px-3" : "px-4")}>
        {file.checks.map(check => {
          const Icon = SYMBOL[check.state];
          return (
            <div key={check.key} className="py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-xs font-extrabold text-[#111214]">{check.label}</span>
                <span className={"inline-flex items-center gap-1 text-[11px] font-bold " + STATE_CLASS[check.state]}>
                  <Icon className="size-3.5" aria-hidden="true" />{STATE_TEXT[check.state]}
                </span>
              </div>
              <p className="mt-1.5 text-xs font-medium leading-5 text-[#3a3d46]">{check.finding}</p>
              {!compact && <p className={UI.small + " mt-1"}>{check.limitation}</p>}
              {check.href && <a href={check.href} rel="noopener noreferrer" target="_blank" className={UI.linkSmall + " mt-1"}>
                {check.linkLabel} <ArrowUpRight className="size-3" aria-hidden="true" />
              </a>}
            </div>
          );
        })}
      </div>
      <div className="mt-4 border-t border-[#111214]/15 pt-3">
        <p className="text-xs font-extrabold text-[#111214]">Next question to investigate</p>
        <p className={UI.small + " mt-1 leading-6"}>{file.reviewQuestion}</p>
        <p className="mt-3 text-[11px] font-medium leading-5 text-[var(--muted)]">{FILE_GRADE_LIMITS}</p>
        <p className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-[var(--muted)]">
          <Files className="size-3" aria-hidden="true" /> Provisional editorial file · updated {file.curatedAt} · no independent scientific signoff
        </p>
      </div>
    </section>
  );
}

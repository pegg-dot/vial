import Link from "next/link";
import { ArrowUpRight, CircleAlert, CircleDashed, FileCheck2, Files, SearchCheck } from "lucide-react";
import { gradeResearchFile, FILE_GRADE_LIMITS, type FileCheckState } from "@/lib/research-file-grade";
import type { ResearchSubject } from "@/lib/research-explorer";

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

/** This badge only describes our curated FILE, not the named peptide. */
export function ResearchFileGradeMark({ subject, withCount = false }: {
  subject: ResearchSubject;
  withCount?: boolean;
}) {
  const file = gradeResearchFile(subject);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border border-[#d5d8da] bg-[#f4f6f6] px-2 py-1 text-[10px] font-extrabold text-[#384148]"
      aria-label={"VialGrade research file coverage " + (file.letter ?? "ungraded") + ", " + file.linkedCount + " of 3 source layers linked"}
      title={"Research file only: " + file.headline + ". Not peptide quality or efficacy."}
    >
      <span className="grid size-5 place-items-center rounded-[4px] bg-[#17191b] text-[11px] font-black text-white" aria-hidden="true">
        {file.letter ?? "?"}
      </span>
      File coverage {file.letter ?? "ungraded"}
      {withCount && <span className="font-semibold text-[#737c82]">· {file.linkedCount}/3</span>}
    </span>
  );
}

/** Reuses original VialGrade's decomposed grade pattern but deliberately
 * removes the vendor trust, purity and product scores. */
export function ResearchFileGradeCard({ subject, compact = false }: {
  subject: ResearchSubject;
  compact?: boolean;
}) {
  const file = gradeResearchFile(subject);
  return (
    <section aria-label={"Research file grade for " + subject.name}
      className={"overflow-hidden rounded-2xl border-2 border-[#17191b] bg-white " + (compact ? "p-4" : "p-5 sm:p-6")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[.12em] text-[#217f72]">
          <SearchCheck className="size-4" /> VialGrade research file
        </p>
        <Link href="/intelligence/grading" className="text-xs font-bold text-[#526474] underline-offset-2 hover:underline">
          How grading works
        </Link>
      </div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[clamp(1.7rem,3vw,2.4rem)] font-black leading-none tracking-[-.06em] text-[#17191b]">{file.linkedCount}<span className="text-xl text-[#7f8b87]">/3</span></p>
          <h2 className="mt-2 text-sm font-extrabold text-[#17191b]">
            {file.linkedCount === 1 ? "Research source type linked" : "Research source types linked"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#4e5961]">{file.headline}</p>
          <p className="mt-2 text-xs font-semibold text-[#787f85]">
            {file.letter ? "File coverage " + file.letter : "No file grade yet"} · {file.linkedCount} of 3 source layers individually linked in this starter file
          </p>
        </div>
        <span className="flex size-[44px] shrink-0 items-center justify-center rounded-lg border-2 border-[#17191b] bg-[#aef2d6] text-xl font-black text-[#17191b]"
          aria-label={"File grade " + (file.letter ?? "not assigned")}>
          {file.letter ?? "—"}
        </span>
      </div>

      <div className={"mt-5 rounded-xl border border-[#e0e3e3] bg-[#f8faf9] " + (compact ? "px-3" : "px-4")}>
        {file.checks.map(check => {
          const Icon = SYMBOL[check.state];
          return (
            <div key={check.key} className="border-t border-[#e0e3e3] py-3.5 first:border-t-0">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-xs font-bold text-[#252d30]">{check.label}</span>
                <span className={"inline-flex items-center gap-1 text-[11px] font-semibold " +
                  (check.state === "linked" ? "text-[#236f5e]" : check.state === "qualified" ? "text-[#9a682b]" : "text-[#818791]")}>
                  <Icon className="size-3.5" />{STATE_TEXT[check.state]}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-5 text-[#5c666b]">{check.finding}</p>
              {!compact && <p className="mt-1 text-xs leading-5 text-[#848a8e]">{check.limitation}</p>}
              {check.href && <a href={check.href} rel="noopener noreferrer" target="_blank"
                className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[#356d65] hover:underline">
                {check.linkLabel} <ArrowUpRight className="size-3" />
              </a>}
            </div>
          );
        })}
      </div>
      <div className="mt-4 border-t border-[#e4e6e6] pt-3">
        <p className="text-xs font-bold text-[#39454b]">Next question to investigate</p>
        <p className="mt-1 text-xs leading-6 text-[#656e73]">{file.reviewQuestion}</p>
        <p className="mt-3 text-[11px] leading-5 text-[#8a8f95]">{FILE_GRADE_LIMITS}</p>
        <p className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-[#8d9297]">
          <Files className="size-3" /> Provisional editorial file · updated {file.curatedAt} · no independent scientific signoff
        </p>
      </div>
    </section>
  );
}

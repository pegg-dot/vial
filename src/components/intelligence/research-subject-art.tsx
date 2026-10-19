import type { ResearchSubject } from "@/lib/research-explorer";
import { researchThemeById } from "@/lib/research-explorer";

/**
 * Identity panels, not AI-generated chemical imagery.
 * We cannot reliably infer an exact molecular drawing from a subject name.
 * Each panel instead shows an editorial category and the actual linked
 * reference label, with the source always inspectable in the dossier.
 */
export function ResearchSubjectArt({
  subject, compact = false, hero = false,
}: {
  subject: ResearchSubject;
  compact?: boolean;
  hero?: boolean;
}) {
  const theme = researchThemeById(subject.theme);
  return (
    <div aria-hidden="true"
      className={"relative flex min-w-0 flex-col justify-between overflow-hidden border-b border-[#dce5de] px-4 py-3.5 " +
        (hero ? "min-h-32 lg:min-h-52 lg:p-6" : compact ? "h-23" : "h-32")}
      style={{ backgroundColor: theme.tint }}>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-[#3b6250]">{theme.name}</span>
        <span className="rounded border border-[#b6cbbb]/60 bg-white/70 px-2 py-0.5 font-mono text-[10px] tracking-wide text-[#526d59]">RESEARCH</span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span className={"min-w-0 font-bold tracking-[-.045em] text-[#244333] " +
          (hero ? "text-3xl leading-tight" : "text-lg leading-tight")}>
          {subject.name}
        </span>
        <span className="max-w-[42%] shrink-0 truncate text-right font-mono text-[10px] text-[#4c745a]" title={subject.referenceLabel}>
          {subject.referenceLabel}
        </span>
      </div>
    </div>
  );
}

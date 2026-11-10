"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, GitCompareArrows, X, ClipboardCheck } from "lucide-react";
import { ResearchSubjectArt } from "@/components/intelligence/research-subject-art";
import { ResearchFileGradeCard, ResearchFileGradeMark } from "@/components/intelligence/research-file-grade";
import { Chip, Pill, Quiet, UI } from "@/components/intelligence/research-ui";
import type { ExplorerAudience, ResearchSubject } from "@/lib/research-explorer";

// Pill-shaped links that must also close the dialog on click. The kit's `Pill` drops `onClick`
// on its link form, so these carry the same classes by hand.
const LINK_PILL = "inline-flex items-center justify-center gap-2 rounded-full font-extrabold ";
const LINK_PRIMARY = LINK_PILL + "ink hard-sm press min-h-11 bg-[#2b31d8] px-5 text-sm text-white";
const LINK_GHOST = LINK_PILL + "ink-1 min-h-11 bg-white px-4 text-xs text-[#111214] hover:bg-[#eef0ff]";
const LINK_MINT = LINK_PILL + "ink-1 min-h-11 bg-[#e6fbf6] px-4 text-xs text-[#111214] hover:bg-[#eef0ff]";

export function ResearchQuickView({
  subject,
  audience,
  selected,
  compareLimitReached,
  onClose,
  onCompare,
  onNavigate,
  position,
  count,
}: {
  subject: ResearchSubject | null;
  audience: ExplorerAudience;
  selected: boolean;
  compareLimitReached: boolean;
  onClose: () => void;
  onCompare: (slug: string) => void;
  onNavigate?: (direction: -1 | 1) => void;
  position?: number;
  count?: number;
}) {
  const modal = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = modal.current;
    if (!element) return;
    if (subject && !element.open) element.showModal();
    if (!subject && element.open) element.close();
  }, [subject]);

  // The archived marketplace used Left/Right keys to step through cards in
  // place. Preserve that behavior for research without changing the URL or
  // replacing the original-source context.
  useEffect(() => {
    if (!subject || !onNavigate) return;
    function keydown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") { event.preventDefault(); onNavigate!(1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); onNavigate!(-1); }
    }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [subject, onNavigate]);

  return (
    <dialog
      ref={modal}
      onClose={onClose}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
      aria-label={subject ? "Quick research view: " + subject.name : "Quick research view"}
      className="ink hard-lg m-auto w-[min(94vw,690px)] max-h-[90dvh] overflow-y-auto rounded-[22px] bg-white p-0 text-[#111214] backdrop:bg-[#111214]/65"
    >
      {subject && (
        <div className="min-w-0">
          <div className="relative">
            <ResearchSubjectArt subject={subject} compact />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close quick view"
              autoFocus
              className="ink-1 hard-sm press absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white text-[#111214]"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          {onNavigate && count && count > 1 && (
            <div className="flex items-center justify-between gap-3 border-b-2 border-[#111214] bg-[var(--background)] px-5 py-2 text-xs font-bold">
              <span>Record {(position ?? 0) + 1} of {count}</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => onNavigate(-1)} aria-label="Previous research record" className="ink-1 grid size-9 place-items-center rounded-full bg-white hover:bg-[#eef0ff]"><ChevronLeft className="size-4" aria-hidden="true" /></button>
                <button type="button" onClick={() => onNavigate(1)} aria-label="Next research record" className="ink-1 grid size-9 place-items-center rounded-full bg-white hover:bg-[#eef0ff]"><ChevronRight className="size-4" aria-hidden="true" /></button>
              </div>
            </div>
          )}
          <div className="p-6 sm:p-8">
            <p className={UI.eyebrow}>{subject.family}</p>
            <h2 className={UI.h2 + " mt-2"}>
              {subject.name}
            </h2>
            {subject.alternativeNames.length > 0 && (
              <p className={UI.small + " mt-1"}>Also listed as {subject.alternativeNames.slice(0, 2).join(" · ")}</p>
            )}
            <div className="mt-3"><ResearchFileGradeMark subject={subject} withCount /></div>
            <p className={UI.bodyInk + " mt-4 leading-7"}>{subject.identity}</p>
            <Quiet className="mt-5">
              <p className={UI.eyebrow}>{audience === "researcher" ? "What to investigate" : "What an analyst needs to check"}</p>
              <p className="mt-2 text-sm font-bold leading-6 text-[#111214]">{audience === "researcher" ? subject.studyQuestion : subject.analystAngle}</p>
            </Quiet>
            <div className="mt-5 flex flex-wrap gap-2">
              <Chip>Identity source</Chip>
              <Chip tone={subject.sampleTrial ? "mint" : "paper"}>
                {subject.sampleTrial ? "Selected trial · " + subject.sampleTrial : "Clinical trial not individually pinned"}
              </Chip>
            </div>
            <p className={UI.small + " mt-4 leading-6"}>{subject.identityCaveat}</p>
            <details className="group mt-4">
              <summary className={UI.linkSmall + " cursor-pointer list-none [&::-webkit-details-marker]:hidden"}>
                Why did this research file get that grade? <ChevronDown className="size-3.5 transition group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="mt-3"><ResearchFileGradeCard subject={subject} compact /></div>
            </details>
            <div className="mt-6 flex flex-wrap gap-3 border-t-2 border-[#111214]/10 pt-5">
              <Link
                href={"/intelligence/explore/" + subject.slug}
                onClick={onClose}
                className={LINK_PRIMARY}
              >
                Open research dossier <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Pill variant="secondary" icon={GitCompareArrows} onClick={() => { onCompare(subject.slug); onClose(); }}
                disabled={compareLimitReached && !selected} className="disabled:cursor-not-allowed">
                {selected ? "Remove from compare" : "Add to compare"}
              </Pill>
              <Link href={"/intelligence/materials?subject=" + encodeURIComponent(subject.slug)} onClick={onClose} className={LINK_GHOST}>
                <ClipboardCheck className="size-4 text-[#2b31d8]" aria-hidden="true" /> Material file · unverified
              </Link>
              {subject.slug === "pexiganan" && (
                <Link href="/intelligence/passports/pexiganan" onClick={onClose} className={LINK_MINT}>
                  Evidence passport <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              )}
              <a href={subject.referenceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 px-2 text-xs font-extrabold text-[#2b31d8] hover:underline">
                Original identity record <ArrowUpRight className="size-4" aria-hidden="true" />
              </a>
            </div>
            <p className={UI.small + " mt-4"}>
              Original identifiers are not scientific effectiveness rankings, product recommendations or permission to buy.
            </p>
          </div>
        </div>
      )}
    </dialog>
  );
}

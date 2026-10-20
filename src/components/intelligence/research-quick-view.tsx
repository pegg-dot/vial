"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, GitCompareArrows, X, ClipboardCheck } from "lucide-react";
import { ResearchSubjectArt } from "@/components/intelligence/research-subject-art";
import { ResearchFileGradeCard, ResearchFileGradeMark } from "@/components/intelligence/research-file-grade";
import { researchThemeById, type ExplorerAudience, type ResearchSubject } from "@/lib/research-explorer";

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
      className="m-auto w-[min(94vw,690px)] max-h-[90dvh] overflow-y-auto rounded-[22px] border-2 border-[#17191b] bg-white p-0 text-[#17191b] shadow-[10px_12px_0_#161819]/35 backdrop:bg-[#141517]/65"
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
              className="absolute right-4 top-4 grid size-10 place-items-center rounded-full border-2 border-[#16191b] bg-white text-[#16191b] transition-transform hover:-translate-y-0.5"
            >
              <X className="size-4" />
            </button>
          </div>
          {onNavigate && count && count > 1 && (
            <div className="flex items-center justify-between gap-3 border-b-2 border-[#111214] bg-[#f7f7f4] px-5 py-2 text-xs font-bold">
              <span>Record {(position ?? 0) + 1} of {count}</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => onNavigate(-1)} aria-label="Previous research record" className="ink-1 grid size-9 place-items-center rounded-full bg-white hover:bg-[#eef0ff]"><ChevronLeft className="size-4" /></button>
                <button type="button" onClick={() => onNavigate(1)} aria-label="Next research record" className="ink-1 grid size-9 place-items-center rounded-full bg-white hover:bg-[#eef0ff]"><ChevronRight className="size-4" /></button>
              </div>
            </div>
          )}
          <div className="p-6 sm:p-8">
            <p className="text-[11px] font-extrabold uppercase tracking-[.14em]" style={{ color: researchThemeById(subject.theme).color }}>
              {subject.family}
            </p>
            <h2 className="mt-2 text-[clamp(1.8rem,4vw,2.65rem)] font-extrabold tracking-[-.055em]">
              {subject.name}
            </h2>
            {subject.alternativeNames.length > 0 && (
              <p className="mt-1 text-xs text-[#787c88]">Also listed as {subject.alternativeNames.slice(0, 2).join(" · ")}</p>
            )}
            <div className="mt-3"><ResearchFileGradeMark subject={subject} withCount /></div>
            <p className="mt-4 text-sm leading-7 text-[#515866]">{subject.identity}</p>
            <div className="mt-5 rounded-xl border border-[#e3e5ea] bg-[#f8f9f9] p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-[.13em] text-[#397267]">{audience === "researcher" ? "What to investigate" : "What an analyst needs to check"}</p>
              <p className="mt-2 text-sm font-semibold leading-6">{audience === "researcher" ? subject.studyQuestion : subject.analystAngle}</p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex rounded-full border border-[#dedee5] bg-white px-3 py-1.5 text-xs font-semibold text-[#606474]">
                Identity source
              </span>
              <span className={"inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold " +
                (subject.sampleTrial ? "border-[#c3e3d2] bg-[#edf9f2] text-[#357861]" : "border-[#e0dfe8] bg-[#f7f7f9] text-[#737483]")}>
                {subject.sampleTrial ? "Selected trial · " + subject.sampleTrial : "Clinical trial not individually pinned"}
              </span>
            </div>
            <p className="mt-4 text-xs leading-6 text-[#777c86]">{subject.identityCaveat}</p>
            <details className="group mt-4">
              <summary className="cursor-pointer text-xs font-extrabold text-[#2f776d] underline underline-offset-2">
                Why did this research file get that grade?
              </summary>
              <div className="mt-3"><ResearchFileGradeCard subject={subject} compact /></div>
            </details>
            <div className="mt-6 flex flex-wrap gap-3 border-t border-[#e4e5e9] pt-5">
              <Link
                href={"/intelligence/explore/" + subject.slug}
                onClick={onClose}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#17191b] px-5 py-3 text-sm font-bold text-white hover:bg-[#34383a]"
              >
                Open research dossier <ArrowRight className="size-4" />
              </Link>
              <button type="button" onClick={() => { onCompare(subject.slug); onClose(); }}
                disabled={compareLimitReached && !selected}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-[#202125] px-4 py-2.5 text-xs font-extrabold text-[#202125] hover:bg-[#f2f1f6] disabled:cursor-not-allowed disabled:opacity-40">
                <GitCompareArrows className="size-4" /> {selected ? "Remove from compare" : "Add to compare"}
              </button>
              <Link href={"/intelligence/materials?subject=" + encodeURIComponent(subject.slug)} onClick={onClose}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#bcd9c7] bg-[#f4fcf7] px-3 py-2.5 text-xs font-extrabold text-[#296a53] hover:bg-[#e3f7e8]">
                <ClipboardCheck className="size-4" /> Material file · unverified
              </Link>
              {subject.slug === "pexiganan" && (
                <Link href="/intelligence/passports/pexiganan" onClick={onClose}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#a8d4bb] bg-[#ecf9f2] px-3 py-2.5 text-xs font-extrabold text-[#296a53] hover:bg-[#d8f2e1]">
                  Evidence passport <ArrowRight className="size-3.5" />
                </Link>
              )}
              <a href={subject.referenceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 px-2 text-xs font-semibold text-[#5e5295] hover:underline">
                Original identity record <ArrowUpRight className="size-4" />
              </a>
            </div>
            <p className="mt-4 text-[11px] leading-5 text-[#8d909a]">
              Original identifiers are not scientific effectiveness rankings, product recommendations or permission to buy.
            </p>
          </div>
        </div>
      )}
    </dialog>
  );
}

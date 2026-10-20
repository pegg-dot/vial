"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, GitCompareArrows, X } from "lucide-react";
import { CollectionRow } from "@/components/market/collection-row";
import { ResearchQuickView } from "@/components/intelligence/research-quick-view";
import { RESEARCH_SUBJECTS, type ResearchSubject } from "@/lib/research-explorer";
import { gradeResearchFile } from "@/lib/research-file-grade";

const STUDIES = RESEARCH_SUBJECTS.filter(subject => Boolean(subject.sampleTrial));
const LINEAGES = [
  "magainin-2", "pexiganan", "somatostatin-14", "octreotide", "lanreotide", "oxytocin", "arginine-vasopressin",
].map(slug => RESEARCH_SUBJECTS.find(item => item.slug === slug)!).filter(Boolean);
const DISCOVERY = ["retatrutide", "tirzepatide", "cagrilintide", "nisin-a", "ziconotide", "cyclosporin-a"]
  .map(slug => RESEARCH_SUBJECTS.find(item => item.slug === slug)!).filter(Boolean);

function ShelfCard({ subject, badge, onOpen }: { subject: ResearchSubject; badge: string; onOpen: () => void }) {
  const grade = gradeResearchFile(subject);
  return (
    <button type="button" onClick={onOpen} aria-label={"Quick view " + subject.name}
      className="ink-1 hard-sm press group flex h-[172px] w-[248px] shrink-0 snap-start flex-col rounded-[14px] bg-white p-3.5 text-left">
      <div className="flex items-center gap-2">
        <span className="ink-1 inline-flex h-5 shrink-0 items-center rounded-[5px] bg-white px-1.5 text-[10px] font-extrabold uppercase tracking-[.1em]">{subject.alternativeNames[0]?.slice(0, 9) || subject.name.slice(0, 8)}</span>
        <span className="min-w-0 flex-1 truncate text-[10px] font-bold uppercase tracking-[.08em] text-[var(--muted)]">{subject.family}</span>
        <ArrowUpRight className="size-4 shrink-0 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>
      <h3 className="mt-2.5 truncate text-[17px] font-extrabold leading-tight tracking-[-.03em]">{subject.name}</h3>
      <div className="mt-2.5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[19px] font-extrabold leading-none tracking-[-.04em]">{subject.sampleTrial || "Identity on file"}</p>
          <p className="mt-1 truncate text-[11px] font-semibold text-[var(--muted)]">{subject.referenceLabel}</p>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t-2 border-[#111214]/10 pt-2.5 text-[11px] font-bold">
        <span className="min-w-0 flex-1 truncate text-[#0e8f80]">{badge}</span>
        <span className="shrink-0 text-[#2b31d8]">File {grade.letter || "—"}</span>
      </div>
    </button>
  );
}

/** The original MarketExperience's horizontal shelves + in-place arrow-key
 * modal, backed exclusively by hand-reviewed research subject metadata. */
export function ResearchMarketShelves() {
  const [shelf, setShelf] = useState<readonly ResearchSubject[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const current = activeIndex === null ? null : shelf[activeIndex] ?? null;

  function open(items: readonly ResearchSubject[], index: number) {
    setShelf(items);
    setActiveIndex(index);
  }
  function toggle(slug: string) {
    setSelected(old => old.includes(slug) ? old.filter(value => value !== slug) : old.length < 3 ? [...old, slug] : old);
  }
  const compareHref = useMemo(() => "/intelligence/compare?subjects=" + encodeURIComponent(selected.join(",")) + "&audience=researcher", [selected]);

  return (
    <div>
      <CollectionRow eyebrow="Five individually matched registry examples" title="Studies on file"
        blurb="Each record links a named research molecule to one selected public registration. No study outcome is inferred."
        seeAllHref="/intelligence/market#browse" seeAllLabel="All compounds">
        {STUDIES.map((item, i) => <ShelfCard key={item.slug} subject={item} badge="Trial example" onOpen={() => open(STUDIES,i)} />)}
      </CollectionRow>
      <CollectionRow eyebrow="Follow the identity" title="Related research, kept separate"
        blurb="Compare peptide families and analogues without assuming that findings belong to the same compound."
        seeAllHref="/intelligence/compare?subjects=magainin-2%2Cpexiganan" seeAllLabel="Compare an example">
        {LINEAGES.map((item, i) => <ShelfCard key={item.slug} subject={item} badge="Related molecular records" onOpen={() => open(LINEAGES,i)} />)}
      </CollectionRow>
      <CollectionRow eyebrow="Browse another subject" title="Across the research areas"
        blurb="A selection from the sixteen published identity workpapers. These are not trending, ranked or endorsed compounds."
        seeAllHref="/intelligence/market#browse" seeAllLabel="All sixteen records">
        {DISCOVERY.map((item, i) => <ShelfCard key={item.slug} subject={item} badge="Source-linked profile" onOpen={() => open(DISCOVERY,i)} />)}
      </CollectionRow>

      {selected.length > 0 && (
        <section aria-label="Research shelf comparison" className="sticky bottom-4 z-30 mx-auto flex max-w-[900px] flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-[#111214] bg-[#2b31d8] p-4 text-white shadow-[5px_5px_0_#111214]">
          <div className="min-w-0">
            <p className="text-xs font-bold">Compare research files · {selected.length}/3</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{selected.map(slug => (
              <button key={slug} onClick={() => toggle(slug)} aria-label={"Remove " + slug}
                className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold">{RESEARCH_SUBJECTS.find(item => item.slug === slug)?.name}<X className="size-3" /></button>
            ))}</div>
          </div>
          <Link href={selected.length < 2 ? "#" : compareHref} aria-disabled={selected.length < 2}
            onClick={event => { if (selected.length < 2) event.preventDefault(); }}
            className={"ink inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold " +
              (selected.length < 2 ? "cursor-not-allowed bg-white/30 text-white/75" : "bg-white text-[#111214]")}>
            Compare <GitCompareArrows className="size-4" />
          </Link>
        </section>
      )}
      <ResearchQuickView subject={current} audience="researcher" selected={Boolean(current && selected.includes(current.slug))}
        compareLimitReached={selected.length >= 3}
        onClose={() => setActiveIndex(null)} onCompare={toggle}
        onNavigate={direction => setActiveIndex(old => old === null ? null : (old + direction + shelf.length) % shelf.length)}
        position={activeIndex ?? 0} count={shelf.length} />
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, Check, FilterX, GitCompareArrows,
  Grid2X2, Search, X,
} from "lucide-react";
import {
  compareExplorerHref, RESEARCH_SUBJECTS, RESEARCH_THEMES, researchThemeById,
  type ExplorerAudience, type ResearchThemeId,
} from "@/lib/research-explorer";
import { ResearchSubjectArt } from "@/components/intelligence/research-subject-art";
import { ResearchQuickView } from "@/components/intelligence/research-quick-view";
import { ResearchFileGradeMark } from "@/components/intelligence/research-file-grade";
import { gradeResearchFile, sortSubjectsByFileCoverage } from "@/lib/research-file-grade";

type SourceFilter = "all" | "selected-trial" | "identity-only";
type GradeFilter = "all" | "A" | "B" | "C" | "ungraded";
type SortMode = "editorial" | "source-coverage";

const themeSymbol: Record<ResearchThemeId, string> = {
  metabolic: "◉", "host-defense": "✳", neuropeptides: "◎", constrained: "⌬",
};

/**
 * Marketplace-style navigation over a NONcommercial, fixed scientific index.
 * The old seller catalog, partner data, customer preferences and pricing
 * are never imported. Counts describe only the 16 curated starter subjects.
 */
export function ResearchExplorer() {
  const [query, setQuery] = useState("");
  const [themeId, setThemeId] = useState<ResearchThemeId | "all">("all");
  const [audience, setAudience] = useState<ExplorerAudience>("researcher");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("editorial");
  const [selected, setSelected] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [quickViewSlug, setQuickViewSlug] = useState<string | null>(null);

  const matching = useMemo(() => {
    const q = query.trim().toLowerCase();
    return RESEARCH_SUBJECTS.filter(subject => {
      if (themeId !== "all" && subject.theme !== themeId) return false;
      if (sourceFilter === "selected-trial" && !subject.sampleTrial) return false;
      if (sourceFilter === "identity-only" && subject.sampleTrial) return false;
      const fileLetter = gradeResearchFile(subject).letter ?? "ungraded";
      if (gradeFilter !== "all" && gradeFilter !== fileLetter) return false;
      if (!q) return true;
      const theme = researchThemeById(subject.theme);
      return [
        subject.name, subject.family, subject.mechanism, subject.studyQuestion,
        subject.identity, theme.name, ...subject.alternativeNames,
      ].some(value => value.toLowerCase().includes(q));
    });
  }, [query, themeId, sourceFilter, gradeFilter]);

  const featuredMode = themeId === "all" && !query.trim() && sourceFilter === "all" &&
    gradeFilter === "all" && sortMode === "editorial" && !showAll;
  const visible = featuredMode
    ? RESEARCH_THEMES.flatMap(theme => matching.filter(subject => subject.theme === theme.id).slice(0, 2))
    : sortMode === "source-coverage" ? sortSubjectsByFileCoverage(matching) : matching;
  const pinned = RESEARCH_SUBJECTS.filter(subject => subject.sampleTrial);
  const peek = RESEARCH_SUBJECTS.find(item => item.slug === quickViewSlug) ?? null;

  function toggleCompare(slug: string) {
    setSelected(old => old.includes(slug)
      ? old.filter(item => item !== slug)
      : old.length < 3 ? [...old, slug] : old);
  }

  function clear() {
    setQuery("");
    setThemeId("all");
    setSourceFilter("all");
    setGradeFilter("all");
    setSortMode("editorial");
    setShowAll(false);
  }

  return (
    <div className="space-y-9">
      <section aria-labelledby="discover-themes" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="discover-themes" className="text-xl font-extrabold tracking-[-.045em] text-[#17191b]">Choose a research direction</h2>
            <p className="mt-1 text-sm text-[#737981]">Browse by biology, just like a category aisle.</p>
          </div>
          <span className="text-xs font-semibold text-[#677a78]">4 themes · 16 curated subjects</span>
        </div>
        <div className="scroll-fade-x -mx-5 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8" aria-label="Research theme categories">
          <div className="flex w-max gap-2.5">
            <button
              type="button"
              onClick={() => setThemeId("all")}
              aria-pressed={themeId === "all"}
              className={"inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full border-2 border-[#17191b] px-4 py-2 text-sm font-extrabold transition-transform hover:-translate-y-0.5 " +
                (themeId === "all" ? "bg-[#17191b] text-white" : "bg-white text-[#17191b]")}
            >
              <Grid2X2 className="size-4" /> All research <span className="text-xs opacity-65">16</span>
            </button>
            {RESEARCH_THEMES.map(theme => (
              <button
                key={theme.id}
                type="button"
                aria-pressed={themeId === theme.id}
                onClick={() => setThemeId(old => old === theme.id ? "all" : theme.id)}
                className={"inline-flex min-h-12 shrink-0 items-center gap-2.5 rounded-full border-2 border-[#17191b] px-4 py-2 text-sm font-bold transition-transform hover:-translate-y-0.5 " +
                  (themeId === theme.id ? "bg-[#17191b] text-white" : "bg-white text-[#17191b]")}
              >
                <span className="grid size-7 place-items-center rounded-full text-lg font-black"
                  style={{ backgroundColor: theme.tint, color: theme.color }} aria-hidden="true">{themeSymbol[theme.id]}</span>
                {theme.name} <span className="text-xs opacity-65">{RESEARCH_SUBJECTS.filter(subject => subject.theme === theme.id).length}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {themeId === "all" && !query.trim() && sourceFilter === "all" && gradeFilter === "all" && (
      <section aria-label="Selected clinical study source shelf" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[.17em] text-[#168e7f]">A good place to begin</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-[-.05em] text-[#17191b]">Start with an actual study</h2>
            <p className="mt-1 text-sm leading-6 text-[#707780]">
              Five selected, original registry examples. Neither a ranking nor all existing trials.
            </p>
          </div>
          <button type="button" onClick={() => { setSourceFilter("selected-trial"); setThemeId("all"); setQuery(""); setShowAll(true); document.getElementById("browse-title")?.scrollIntoView({ behavior: "smooth" }); }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-[#17191b] bg-white px-4 py-2 text-xs font-extrabold text-[#17191b] hover:bg-[#edf8f2]">
            See all 5 <ArrowRight className="size-4" />
          </button>
        </div>
        <div className="scroll-fade-x -mx-5 overflow-x-auto px-5 pb-3 sm:-mx-8 sm:px-8" aria-label="Swipe selected study examples">
          <div className="flex w-max snap-x snap-mandatory gap-3.5">
            {pinned.map(subject => (
              <article key={subject.slug} className="w-[220px] shrink-0 snap-start overflow-hidden rounded-[17px] border-2 border-[#17191b] bg-white shadow-[4px_5px_0_rgba(23,25,27,0.12)] sm:w-[235px]">
                <ResearchSubjectArt subject={subject} compact />
                <div className="p-4">
                  <h3 className="text-lg font-extrabold tracking-[-.04em] text-[#17191b]">{subject.name}</h3>
                  <p className="mt-0.5 text-xs font-semibold text-[#64716e]">Study {subject.sampleTrial}</p>
                  <div className="mt-2"><ResearchFileGradeMark subject={subject} withCount /></div>
                  <button type="button" onClick={() => setQuickViewSlug(subject.slug)}
                    aria-label={"Quick view " + subject.name}
                    className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#17191b] px-3 py-2 text-xs font-extrabold text-white hover:bg-[#343839]">
                    Quick look <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      )}

      <section aria-labelledby="browse-title" className="scroll-mt-24 space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[.15em] text-[#168e7f]">The research index</p>
            <h2 id="browse-title" className="mt-1 text-3xl font-extrabold tracking-[-.055em] text-[#17191b]">Explore the research</h2>
            <p className="mt-1 text-sm leading-6 text-[#757982]">Browse like a marketplace. Open original evidence instead of products.</p>
            <Link href="/intelligence/grading" className="mt-2 inline-flex text-xs font-bold text-[#347b6d] underline underline-offset-2 hover:text-[#20564c]">What does a research file grade actually mean?</Link>
          </div>
          <div aria-label="Research perspective" className="inline-flex w-fit rounded-xl border-2 border-[#202225] bg-white p-1 text-xs font-bold">
            <button type="button" aria-pressed={audience === "researcher"} onClick={() => setAudience("researcher")}
              className={"rounded-lg px-4 py-2.5 " + (audience === "researcher" ? "bg-[#17191b] text-white" : "text-[#686b76] hover:bg-[#f1f2f1]")}>Researcher</button>
            <button type="button" aria-pressed={audience === "analyst"} onClick={() => setAudience("analyst")}
              className={"rounded-lg px-4 py-2.5 " + (audience === "analyst" ? "bg-[#17191b] text-white" : "text-[#686b76] hover:bg-[#f1f2f1]")}>Analyst</button>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Search research subjects</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#777f87]" aria-hidden="true" />
            <input type="search" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search peptides, mechanisms, aliases..."
              className="h-12 w-full rounded-xl border-2 border-[#d6dadc] bg-white pl-11 pr-4 text-sm text-[#17191b] outline-none placeholder:text-[#929aa0] focus:border-[#168e7f] focus:ring-2 focus:ring-[#12b3a6]/15" />
          </label>
          <label className="flex items-center gap-2 text-sm text-[#666f75]">
            <span>Theme</span>
            <select value={themeId} onChange={e => setThemeId(e.target.value as ResearchThemeId | "all")}
              className="h-12 min-w-[180px] rounded-xl border-2 border-[#d6dadc] bg-white px-4 text-sm font-bold text-[#252a2d] focus:border-[#168e7f] focus:outline-2 focus:outline-offset-2 focus:outline-[#168e7f]">
              <option value="all">All research areas</option>
              {RESEARCH_THEMES.map(theme => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
            </select>
          </label>
        </div>
        <div aria-label="Source coverage filters" className="flex flex-wrap items-center gap-2">
          {([
            ["all", "All subjects", 16],
            ["selected-trial", "Selected trial example", pinned.length],
            ["identity-only", "Identity source only", RESEARCH_SUBJECTS.length - pinned.length],
          ] as const).map(([value, label, count]) => (
            <button type="button" key={value} aria-pressed={sourceFilter === value}
              onClick={() => setSourceFilter(value)}
              className={"rounded-full border px-3 py-2 text-xs font-bold transition-colors " +
                (sourceFilter === value ? "border-[#17191b] bg-[#17191b] text-white" : "border-[#d8dbdf] bg-white text-[#535c63] hover:border-[#17191b]")}>
              {label} <span className="ml-1 opacity-65">{count}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#58676a]">
            Research file grade
            <select aria-label="Research file grade filter" value={gradeFilter}
              onChange={e => setGradeFilter(e.target.value as GradeFilter)}
              className="min-h-10 rounded-lg border border-[#cad3d1] bg-white px-3 py-2 text-xs font-bold text-[#27332f]">
              <option value="all">All file coverage</option>
              <option value="A">A · Three source layers linked</option>
              <option value="B">B · Two source layers linked</option>
              <option value="C">C · Identity source linked</option>
              <option value="ungraded">Unscored · Identity qualified</option>
            </select>
          </label>
          <label className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#58676a]">
            Sort
            <select aria-label="Sort research file coverage" value={sortMode}
              onChange={e => setSortMode(e.target.value as SortMode)}
              className="min-h-10 rounded-lg border border-[#cad3d1] bg-white px-3 py-2 text-xs font-bold text-[#27332f]">
              <option value="editorial">Curated order</option>
              <option value="source-coverage">Most source layers checked in VialGrade</option>
            </select>
          </label>
        </div>
        <p className="text-xs leading-5 text-[#7f898d]">
          Grades count source layers documented by VialGrade, not peptide quality, efficacy or the complete scientific literature.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-xs font-semibold text-[#677176]">
            Showing {visible.length} of {RESEARCH_SUBJECTS.length} subjects
            {themeId === "all" ? "" : " · " + researchThemeById(themeId).name}
          </p>
          {(themeId !== "all" || query || sourceFilter !== "all" || gradeFilter !== "all" || sortMode !== "editorial") && (
            <button type="button" onClick={clear}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#347c73] hover:underline">
              <FilterX className="size-3.5" /> Clear filters
            </button>
          )}
        </div>

        {matching.length === 0 ? (
          <div className="rounded-[18px] border-2 border-[#17191b] bg-white p-10 text-center">
            <h3 className="text-xl font-extrabold tracking-[-.045em]">Nothing matches these filters.</h3>
            <p className="mt-2 text-sm text-[#737b83]">This is a curated starter collection, not a complete peptide database.</p>
            <button type="button" onClick={clear}
              className="mt-5 rounded-xl bg-[#17191b] px-5 py-3 text-sm font-extrabold text-white">Show all research</button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {visible.map(subject => {
              const isSelected = selected.includes(subject.slug);
              const atLimit = !isSelected && selected.length >= 3;
              return (
                <article key={subject.slug} data-testid="research-card"
                  className="group flex min-w-0 flex-col overflow-hidden rounded-[18px] border-2 border-[#17191b] bg-white shadow-[4px_5px_0_rgba(23,25,27,0.12)] transition-transform hover:-translate-y-1">
                  <ResearchSubjectArt subject={subject} />
                  <div className="flex flex-1 flex-col px-4 pb-4 pt-4">
                    <p className="line-clamp-1 text-[10px] font-extrabold uppercase tracking-[.09em] text-[#858a90]">{subject.family}</p>
                    <h3 className="mt-1 text-xl font-extrabold tracking-[-.05em] text-[#17191b]">{subject.name}</h3>
                    <div className="mt-2"><ResearchFileGradeMark subject={subject} withCount /></div>
                    {subject.slug === "pexiganan" && (
                      <Link href="/intelligence/passports/pexiganan" className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-[#e9f8ef] px-3 py-2 text-[10px] font-extrabold text-[#27735c] hover:underline">
                        Evidence passport <ArrowUpRight className="size-3" />
                      </Link>
                    )}
                    <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[#646c76]">{subject.identity}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {subject.sampleTrial ? (
                        <span className="rounded-full bg-[#e8f8ed] px-2.5 py-1 text-[10px] font-extrabold text-[#286f57]">
                          Selected study · {subject.sampleTrial}
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#f1f2f3] px-2.5 py-1 text-[10px] font-bold text-[#6a7077]">
                          Molecular reference
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex-1">
                      <p className="text-[10px] font-extrabold uppercase tracking-[.1em] text-[#278377]">
                        {audience === "researcher" ? "Research question" : "Diligence question"}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[#333940]">
                        {audience === "researcher" ? subject.studyQuestion : subject.analystAngle}
                      </p>
                    </div>
                    <div className="mt-5 flex items-center gap-2 border-t border-[#e6e8e8] pt-4">
                      <button type="button"
                        onClick={() => setQuickViewSlug(subject.slug)}
                        aria-label={"Quick view " + subject.name}
                        className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg bg-[#17191b] px-2 py-2 text-xs font-extrabold text-white hover:bg-[#343839]">
                        Quick view <ArrowUpRight className="size-3.5" />
                      </button>
                      <button type="button" disabled={atLimit} title={atLimit ? "Compare up to three subjects" : undefined}
                        aria-label={(isSelected ? "Remove " : "Compare ") + subject.name} aria-pressed={isSelected}
                        onClick={() => toggleCompare(subject.slug)}
                        className={"grid size-10 shrink-0 place-items-center rounded-lg border-2 border-[#17191b] transition-colors disabled:cursor-not-allowed disabled:opacity-35 " +
                          (isSelected ? "bg-[#aef2d6]" : "bg-white hover:bg-[#e9faf2]")}>
                        {isSelected ? <Check className="size-4" /> : <GitCompareArrows className="size-4" />}
                      </button>
                    </div>
                    <Link href={"/intelligence/explore/" + subject.slug}
                      aria-label={"Open research dossier: " + subject.name}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#357e76] hover:underline">
                      Full research dossier <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {featuredMode && (
          <div className="flex flex-col items-center gap-2 py-4">
            <button type="button" onClick={() => setShowAll(true)}
              className="inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-[#17191b] bg-white px-6 py-3 text-sm font-extrabold text-[#17191b] hover:bg-[#e9f9f1]">
              Browse all 16 research subjects <ArrowRight className="size-4" />
            </button>
            <p className="text-center text-xs text-[#798188]">Eight starting points across four themes. Not a ranking.</p>
          </div>
        )}
      </section>

      {selected.length > 0 && (
        <section aria-label="Comparison selection" className="sticky bottom-4 z-30 mx-auto max-w-[920px] rounded-2xl border-2 border-[#17191b] bg-[#17191b] p-3 text-white shadow-[0_15px_45px_rgba(27,24,58,.25)] sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-white/65">RESEARCH COMPARISON · {selected.length}/3</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {selected.map(slug => {
                  const subject = RESEARCH_SUBJECTS.find(item => item.slug === slug)!;
                  return (
                    <button key={slug} type="button" onClick={() => toggleCompare(slug)}
                      aria-label={"Remove " + subject.name}
                      className="inline-flex items-center gap-1.5 rounded-md bg-white/15 px-2.5 py-1.5 text-xs font-medium hover:bg-white/25">
                      {subject.name} <X className="size-3" />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setSelected([])} className="rounded-md px-3 py-2 text-xs font-bold text-white/75 hover:text-white">
                Clear
              </button>
              <Link aria-disabled={selected.length < 2} href={selected.length < 2 ? "#" : compareExplorerHref(selected, audience)}
                onClick={event => { if (selected.length < 2) event.preventDefault(); }}
                className={"inline-flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-xs font-extrabold " +
                  (selected.length >= 2 ? "bg-[#aef2d6] text-[#183b32] hover:bg-[#d1ffeb]" : "cursor-not-allowed bg-white/30 text-white/65")}>
                Compare subjects <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
          {selected.length < 2 && <p className="mt-2 text-xs text-white/65">Select one more subject to compare original research contexts.</p>}
        </section>
      )}

      <ResearchQuickView
        subject={peek}
        audience={audience}
        selected={Boolean(peek && selected.includes(peek.slug))}
        compareLimitReached={selected.length >= 3}
        onClose={() => setQuickViewSlug(null)}
        onCompare={toggleCompare}
      />
    </div>
  );
}

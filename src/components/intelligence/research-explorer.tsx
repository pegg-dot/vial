"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, GitCompareArrows, Search, SlidersHorizontal, X } from "lucide-react";
import {
  compareExplorerHref, RESEARCH_SUBJECTS, RESEARCH_THEMES, researchThemeById,
  type ExplorerAudience, type ResearchThemeId,
} from "@/lib/research-explorer";
import { ResearchSubjectArt } from "@/components/intelligence/research-subject-art";
import { ResearchQuickView } from "@/components/intelligence/research-quick-view";
import { ResearchFileGradeMark } from "@/components/intelligence/research-file-grade";
import { Frame, Pill, UI } from "@/components/intelligence/research-ui";
import { gradeResearchFile, sortSubjectsByFileCoverage } from "@/lib/research-file-grade";
import {
  DEFAULT_EXPLORER_STATE, MAX_COMPARE, parseExplorerState, serializeExplorerState,
  type ExplorerState, type GradeFilter, type SortMode, type SourceFilter,
} from "@/lib/research-explorer-state";

const RETURN_KEY = "vialgrade:explorer-return";
const RETURN_WINDOW_MS = 60 * 60 * 1000;

/** One pressed/unpressed pill for the theme rail, the record filters and the perspective toggle. */
function pill(active: boolean, size: "md" | "sm" = "md") {
  return "ink-1 inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-extrabold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b31d8] " +
    (size === "sm" ? "min-h-9 px-3.5 text-xs " : "min-h-10 px-4 text-sm ") +
    (active ? "bg-[#111214] text-white" : "bg-white text-[#111214] hover:bg-[#eef0ff]");
}

/** The field with a leading icon: the landing hero's source-check pattern, thin frame. */
const FIELD_SHELL = "ink-1 flex items-center gap-3 rounded-2xl bg-white px-4 transition-shadow focus-within:shadow-[3px_3px_0_0_#2b31d8]";
const SELECT = "ink-1 min-h-10 rounded-[10px] bg-white px-3 text-xs font-bold text-[#111214]";

/**
 * Restore the old market's find -> quick view -> compare -> original record
 * sequence, without loading its products, inventory, providers or tracking.
 */
export function ResearchExplorer({ initial = DEFAULT_EXPLORER_STATE }: {
  initial?: ExplorerState;
}) {
  const [query, setQuery] = useState(initial.query);
  const [themeId, setThemeId] = useState<ResearchThemeId | "all">(initial.theme);
  const [audience, setAudience] = useState<ExplorerAudience>(initial.audience);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(initial.source);
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>(initial.grade);
  const [sortMode, setSortMode] = useState<SortMode>(initial.sort);
  const [selected, setSelected] = useState<string[]>(initial.compare);
  const [quickViewSlug, setQuickViewSlug] = useState<string | null>(null);

  // Next's router puts the entry's original URL back when Back lands on this page, so the query
  // string alone cannot bring the controls back after a dossier visit. When the visitor leaves for
  // a dossier the controls are parked in sessionStorage, and restored once if they return to a
  // page with no filters in its URL. One-shot, so a later fresh visit to Market starts clean.
  useEffect(() => {
    if (serializeExplorerState(initial) !== "") return;
    try {
      const raw = window.sessionStorage.getItem(RETURN_KEY);
      if (!raw) return;
      window.sessionStorage.removeItem(RETURN_KEY);
      const saved = JSON.parse(raw) as { at: number; state: unknown };
      if (Date.now() - saved.at > RETURN_WINDOW_MS) return;
      const restored = parseExplorerState(Object.fromEntries(new URLSearchParams(String(saved.state))));
      // Deferred a tick: this is a one-time sync from an external store after hydration, not a
      // render-loop cascade, and the hydrated markup has to match the server's first.
      queueMicrotask(() => {
        setQuery(restored.query); setThemeId(restored.theme); setAudience(restored.audience);
        setSourceFilter(restored.source); setGradeFilter(restored.grade); setSortMode(restored.sort);
        setSelected(restored.compare);
      });
    } catch { /* storage blocked or unreadable: the controls just start at their defaults */ }
    // Mount only: `initial` is the server's reading of the URL and never changes for this instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function parkControlsForReturn(event: React.MouseEvent) {
    if (!(event.target as Element).closest('a[href^="/compounds/"]')) return;
    try {
      window.sessionStorage.setItem(RETURN_KEY, JSON.stringify({
        at: Date.now(),
        state: serializeExplorerState({
          query, theme: themeId, audience, source: sourceFilter, grade: gradeFilter, sort: sortMode, compare: selected,
        }),
      }));
    } catch { /* storage blocked: Back simply resets the controls */ }
  }

  // Mirror the controls into the address bar. replaceState, not push: every keystroke in the
  // search box must not add a history entry. The hash is kept so "#browse" links still land.
  useEffect(() => {
    const next = serializeExplorerState({
      query, theme: themeId, audience, source: sourceFilter, grade: gradeFilter, sort: sortMode, compare: selected,
    });
    const url = window.location.pathname + (next ? "?" + next : "") + window.location.hash;
    if (url !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.replaceState(null, "", url);
    }
  }, [query, themeId, audience, sourceFilter, gradeFilter, sortMode, selected]);

  const matching = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = RESEARCH_SUBJECTS.filter(subject => {
      if (themeId !== "all" && subject.theme !== themeId) return false;
      if (sourceFilter === "selected-trial" && !subject.sampleTrial) return false;
      if (sourceFilter === "identity-only" && subject.sampleTrial) return false;
      const letter = gradeResearchFile(subject).letter ?? "ungraded";
      if (gradeFilter !== "all" && letter !== gradeFilter) return false;
      if (!q) return true;
      const theme = researchThemeById(subject.theme);
      return [
        subject.name, subject.family, subject.mechanism, subject.studyQuestion,
        subject.identity, theme.name, ...subject.alternativeNames,
      ].some(item => item.toLowerCase().includes(q));
    });
    return sortMode === "source-coverage" ? sortSubjectsByFileCoverage(result) : result;
  }, [query, themeId, sourceFilter, gradeFilter, sortMode]);

  const peek = matching.find(item => item.slug === quickViewSlug) ?? null;
  const peekIndex = matching.findIndex(item => item.slug === quickViewSlug);
  function navigatePeek(direction: -1 | 1) {
    if (peekIndex < 0 || !matching.length) return;
    const next = (peekIndex + direction + matching.length) % matching.length;
    setQuickViewSlug(matching[next].slug);
  }
  const activeFilters = themeId !== "all" || Boolean(query) || sourceFilter !== "all" ||
    gradeFilter !== "all" || sortMode !== "editorial";

  function toggleCompare(slug: string) {
    setSelected(old => old.includes(slug)
      ? old.filter(item => item !== slug)
      : old.length < MAX_COMPARE ? [...old, slug] : old);
  }
  function clear() {
    setQuery("");
    setThemeId("all");
    setSourceFilter("all");
    setGradeFilter("all");
    setSortMode("editorial");
  }

  return (
    <div className="space-y-5" onClickCapture={parkControlsForReturn}>
      <section aria-labelledby="browse-title" className="scroll-mt-28">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="browse-title" className={UI.h3}>Compounds</h2>
          </div>
          <span className={UI.small}>16 curated research records · No products for sale</span>
        </div>
        <label className={FIELD_SHELL + " mt-5"}>
          <span className="sr-only">Search research subjects</span>
          <Search aria-hidden="true" className="size-5 shrink-0 text-[#2b31d8]" />
          <input type="search" value={query} onChange={event => setQuery(event.target.value)}
            placeholder="Search a peptide, mechanism or other name"
            className="min-h-12 min-w-0 flex-1 bg-transparent text-base font-medium text-[#111214] outline-none placeholder:text-[#111214]/50" />
        </label>
      </section>

      <section aria-label="Research theme categories" className="border-b border-[#111214]/15 pb-4">
        <div className="-mx-5 overflow-x-auto px-5 sm:-mx-8 sm:px-8">
          <div className="flex w-max items-center gap-2">
            <button type="button" aria-pressed={themeId === "all"} onClick={() => setThemeId("all")} className={pill(themeId === "all")}>
              All areas
            </button>
            {RESEARCH_THEMES.map(theme => (
              <button type="button" key={theme.id} aria-pressed={themeId === theme.id}
                onClick={() => setThemeId(old => old === theme.id ? "all" : theme.id)}
                className={pill(themeId === theme.id)}>
                {theme.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section aria-label="Research filters" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex max-w-full flex-nowrap items-center gap-2 overflow-x-auto pb-1">
            {([
              ["all", "All records"],
              ["selected-trial", "With trial example"],
              ["identity-only", "Identity record only"],
            ] as const).map(([value, label]) => (
              <button type="button" key={value} aria-pressed={sourceFilter === value}
                onClick={() => setSourceFilter(value)} className={pill(sourceFilter === value, "sm")}>
                {label}
              </button>
            ))}
          </div>
          {activeFilters && (
            <button type="button" onClick={clear} className={UI.linkSmall}>Clear filters</button>
          )}
        </div>
        <details className="group ink-1 rounded-[14px] bg-white">
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3.5 py-2 text-xs font-extrabold text-[#111214] [&::-webkit-details-marker]:hidden">
            <SlidersHorizontal className="size-4 text-[#2b31d8]" aria-hidden="true" /> More filters <ChevronDown className="ml-auto size-4 text-[var(--muted)] transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="flex flex-wrap items-end gap-4 border-t border-[#111214]/15 px-3.5 py-4">
            <label className="grid gap-1.5 text-xs font-extrabold text-[#111214]">
              File coverage
              <select aria-label="Research file grade filter" value={gradeFilter}
                onChange={event => setGradeFilter(event.target.value as GradeFilter)} className={SELECT}>
                <option value="all">All source files</option>
                <option value="A">A · 3 source layers linked</option>
                <option value="B">B · 2 source layers linked</option>
                <option value="C">C · 1 source layer linked</option>
                <option value="ungraded">Not graded</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-extrabold text-[#111214]">
              Sort
              <select aria-label="Sort research file coverage" value={sortMode}
                onChange={event => setSortMode(event.target.value as SortMode)} className={SELECT}>
                <option value="editorial">Curated order</option>
                <option value="source-coverage">Most sources linked</option>
              </select>
            </label>
            <fieldset className="flex flex-wrap gap-2">
              <legend className="mb-1.5 text-xs font-extrabold text-[#111214]">Perspective</legend>
              {(["researcher", "analyst"] as const).map(value => (
                <button type="button" key={value} aria-pressed={audience === value}
                  onClick={() => setAudience(value)} className={pill(audience === value, "sm")}>
                  {value === "researcher" ? "Researcher" : "Analyst"}
                </button>
              ))}
            </fieldset>
            <p className={UI.small + " w-full"}>Grades describe VialGrade&apos;s source documentation, not peptide quality or effectiveness.</p>
          </div>
        </details>
        <div className="flex items-center justify-between gap-3">
          <p role="status" className={UI.small}>
            Showing {matching.length} of {RESEARCH_SUBJECTS.length} compounds
            {themeId === "all" ? "" : " · " + researchThemeById(themeId).name}
          </p>
          <Link href="/intelligence/grading" className={UI.linkSmall}>About file coverage</Link>
        </div>
      </section>

      {matching.length === 0 ? (
        <Frame as="section" thin shadow="none" pad="none" radius="rounded-[16px]" className="px-6 py-12 text-center">
          <h3 className={UI.h3}>No matching compounds</h3>
          <p className={UI.body + " mx-auto mt-2 max-w-md"}>Try a different name or clear the filters. This is a curated research library, not a complete catalog.</p>
          <Pill variant="ink" onClick={clear} className="mt-5">Show all records</Pill>
        </Frame>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {matching.map(subject => {
            const isSelected = selected.includes(subject.slug);
            const atLimit = !isSelected && selected.length >= MAX_COMPARE;
            return (
              <article key={subject.slug} data-testid="research-card"
                className="ink-1 hard-sm group flex min-w-0 flex-col overflow-hidden rounded-[17px] bg-white">
                <ResearchSubjectArt subject={subject} compact />
                <div className="flex flex-1 flex-col p-3.5">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-[10px] font-extrabold uppercase tracking-[.07em] text-[var(--muted)]">{subject.family}</p>
                    <span className="shrink-0 rounded bg-[#eef0ff] px-2 py-1 text-[9px] font-bold text-[#2b31d8]">{subject.sampleTrial ? "Trial example" : "Identity source"}</span>
                  </div>
                  <h3 className="mt-2 truncate text-xl font-extrabold tracking-[-.04em]">{subject.name}</h3>
                  <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold tabular-nums">{subject.sampleTrial ?? "No trial pinned"}</p>
                      <p className="mt-1 truncate text-[11px] font-semibold text-[var(--muted)]">
                        {subject.referenceLabel.match(/CID \d+/)?.[0] || subject.referenceLabel.match(/SID \d+/)?.[0] || "Reference linked"}
                      </p>
                    </div>
                    <div className="text-right"><ResearchFileGradeMark subject={subject} withCount /></div>
                  </div>
                  <p className="mt-3 line-clamp-2 min-h-10 text-xs font-medium leading-5 text-[var(--muted)]">
                    {audience === "researcher" ? subject.studyQuestion : subject.analystAngle}
                  </p>
                  <div className="mt-auto flex items-center gap-2 border-t-2 border-[#111214]/10 pt-3">
                    <button type="button" onClick={() => setQuickViewSlug(subject.slug)}
                      aria-label={"Quick view " + subject.name}
                      className="ink-1 hard-sm press inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-[10px] bg-[#111214] px-2 text-xs font-extrabold text-white">
                      Quick view <ArrowUpRight className="size-3.5" />
                    </button>
                    <Link href={"/compounds/" + subject.slug}
                      aria-label={"Open research dossier: " + subject.name}
                      className="ink-1 grid size-10 shrink-0 place-items-center rounded-[10px] bg-white text-[#111214] hover:bg-[#eef0ff]" title="Full research dossier">
                      <ArrowRight className="size-4" />
                    </Link>
                    <button type="button" disabled={atLimit} aria-pressed={isSelected}
                      aria-label={(isSelected ? "Remove " : "Compare ") + subject.name}
                      title={atLimit ? "Compare up to three compounds" : isSelected ? "Remove from comparison" : "Add to comparison"}
                      onClick={() => toggleCompare(subject.slug)}
                      className={"ink-1 grid size-10 shrink-0 place-items-center rounded-[10px] disabled:cursor-not-allowed disabled:opacity-35 " +
                        (isSelected ? "bg-[#eef0ff] text-[#2b31d8]" : "bg-white text-[#111214] hover:bg-[#eef0ff]")}>
                      {isSelected ? <Check className="size-4" /> : <GitCompareArrows className="size-4" />}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <section aria-labelledby="research-studies-title" className="border-t-2 border-[#111214]/10 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="research-studies-title" className={UI.h3}>Start with an actual study</h2>
            <p className={UI.small + " mt-1"}>Five selected public trial examples. A starting point, not a ranking.</p>
          </div>
          <button type="button" onClick={() => { setSourceFilter("selected-trial"); setThemeId("all"); setQuery(""); document.getElementById("browse-title")?.scrollIntoView({ behavior: "smooth" }); }}
            className={UI.linkSmall}>Show trials in the library <ArrowRight className="size-3.5" aria-hidden="true" /></button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {RESEARCH_SUBJECTS.filter(subject => Boolean(subject.sampleTrial)).map(subject => (
            <Link key={subject.slug} href={"/compounds/" + subject.slug}
              className="ink-1 inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-3.5 text-xs font-extrabold text-[#111214] transition-colors hover:bg-[#eef0ff]">
              {subject.name}<span className="font-medium text-[var(--muted)]">{subject.sampleTrial}</span><ArrowUpRight className="size-3.5 text-[#2b31d8]" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      {selected.length > 0 && (
        <section aria-label="Comparison selection" className="ink hard sticky bottom-4 z-30 mx-auto max-w-[900px] rounded-[16px] bg-[#2b31d8] p-4 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-white/80">Compare selected · {selected.length}/3</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selected.map(slug => {
                  const subject = RESEARCH_SUBJECTS.find(item => item.slug === slug)!;
                  return (
                    <button key={slug} type="button" onClick={() => toggleCompare(slug)}
                      aria-label={"Remove " + subject.name}
                      className="inline-flex min-h-7 items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold hover:bg-white/30">
                      {subject.name} <X className="size-3" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setSelected([])} className="inline-flex min-h-9 items-center rounded-full px-3 text-xs font-bold text-white/85 hover:bg-white/15 hover:text-white">Clear</button>
              <Link aria-disabled={selected.length < 2} href={selected.length < 2 ? "#" : compareExplorerHref(selected, audience)}
                onClick={event => { if (selected.length < 2) event.preventDefault(); }}
                className={"ink inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-xs font-extrabold " +
                  (selected.length >= 2 ? "bg-white text-[#111214] hover:bg-[#eef0ff]" : "cursor-not-allowed bg-white/30 text-white/75")}>
                Compare subjects <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
          {selected.length < 2 && <p className="mt-2 text-xs font-medium text-white/75">Add one more compound to compare their research files.</p>}
        </section>
      )}

      <ResearchQuickView subject={peek} audience={audience}
        selected={Boolean(peek && selected.includes(peek.slug))}
        compareLimitReached={selected.length >= 3}
        onClose={() => setQuickViewSlug(null)} onCompare={toggleCompare}
        onNavigate={navigatePeek} position={peekIndex} count={matching.length} />
    </div>
  );
}

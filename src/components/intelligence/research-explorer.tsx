"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, GitCompareArrows, Search, SlidersHorizontal, X } from "lucide-react";
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

/**
 * Restore the old market's find -> quick view -> compare -> original record
 * sequence, without loading its products, inventory, providers or tracking.
 */
export function ResearchExplorer() {
  const [query, setQuery] = useState("");
  const [themeId, setThemeId] = useState<ResearchThemeId | "all">("all");
  const [audience, setAudience] = useState<ExplorerAudience>("researcher");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("editorial");
  const [selected, setSelected] = useState<string[]>([]);
  const [quickViewSlug, setQuickViewSlug] = useState<string | null>(null);

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

  const peek = RESEARCH_SUBJECTS.find(item => item.slug === quickViewSlug) ?? null;
  const activeFilters = themeId !== "all" || Boolean(query) || sourceFilter !== "all" ||
    gradeFilter !== "all" || sortMode !== "editorial";

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
  }

  return (
    <div className="space-y-5">
      <section aria-labelledby="browse-title" className="scroll-mt-28">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="browse-title" className="text-xl font-bold tracking-[-.045em] text-[#203328]">Compounds</h2>
          <span className="text-xs text-[#738178]">16 curated research records · No products for sale</span>
        </div>
        <label className="relative mt-4 block">
          <span className="sr-only">Search research subjects</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#66776a]" />
          <input type="search" value={query} onChange={event => setQuery(event.target.value)}
            placeholder="Search a peptide, mechanism or other name"
            className="h-13 w-full rounded-xl border border-[#c6d2c9] bg-white pl-12 pr-4 text-base text-[#263a2b] outline-none placeholder:text-[#89948d] focus:border-[#377959] focus:ring-2 focus:ring-[#377959]/15" />
        </label>
      </section>

      <section aria-label="Research theme categories" className="border-b border-[#e0e6df] pb-4">
        <div className="-mx-5 overflow-x-auto px-5 sm:-mx-8 sm:px-8">
          <div className="flex w-max items-center gap-2">
            <button type="button" aria-pressed={themeId === "all"} onClick={() => setThemeId("all")}
              className={"min-h-10 shrink-0 rounded-lg border px-4 py-2 text-sm font-semibold " +
                (themeId === "all" ? "border-[#244c37] bg-[#244c37] text-white" : "border-[#d5e0d7] bg-white text-[#44584b] hover:border-[#799b82]")}>
              All areas
            </button>
            {RESEARCH_THEMES.map(theme => (
              <button type="button" key={theme.id} aria-pressed={themeId === theme.id}
                onClick={() => setThemeId(old => old === theme.id ? "all" : theme.id)}
                className={"min-h-10 shrink-0 rounded-lg border px-4 py-2 text-sm font-semibold " +
                  (themeId === theme.id ? "border-[#244c37] bg-[#244c37] text-white" : "border-[#d5e0d7] bg-white text-[#44584b] hover:border-[#799b82]")}>
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
                onClick={() => setSourceFilter(value)}
                className={"min-h-9 shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold " +
                  (sourceFilter === value ? "border-[#3a6c4e] bg-[#e8f3e8] text-[#25563a]" : "border-[#d8e2d9] bg-white text-[#617268] hover:border-[#8ca895]")}>
                {label}
              </button>
            ))}
          </div>
          {activeFilters && (
            <button type="button" onClick={clear} className="text-xs font-semibold text-[#2f7051] hover:underline">Clear filters</button>
          )}
        </div>
        <details className="group rounded-lg border border-[#e0e5df] bg-white">
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-semibold text-[#47624f] [&::-webkit-details-marker]:hidden">
            <SlidersHorizontal className="size-4" /> More filters <span className="ml-auto text-[#85998a] group-open:rotate-180">⌄</span>
          </summary>
          <div className="flex flex-wrap items-end gap-4 border-t border-[#e3e9e3] px-3 py-4">
            <label className="grid gap-1.5 text-xs font-semibold text-[#53685a]">
              File coverage
              <select aria-label="Research file grade filter" value={gradeFilter}
                onChange={event => setGradeFilter(event.target.value as GradeFilter)}
                className="min-h-10 rounded-md border border-[#ccd8ce] bg-white px-3 text-xs text-[#283a2d]">
                <option value="all">All source files</option>
                <option value="A">A · 3 source layers linked</option>
                <option value="B">B · 2 source layers linked</option>
                <option value="C">C · 1 source layer linked</option>
                <option value="ungraded">Not graded</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-[#53685a]">
              Sort
              <select aria-label="Sort research file coverage" value={sortMode}
                onChange={event => setSortMode(event.target.value as SortMode)}
                className="min-h-10 rounded-md border border-[#ccd8ce] bg-white px-3 text-xs text-[#283a2d]">
                <option value="editorial">Curated order</option>
                <option value="source-coverage">Most sources linked</option>
              </select>
            </label>
            <fieldset className="flex flex-wrap gap-2">
              <legend className="mb-1.5 text-xs font-semibold text-[#53685a]">Perspective</legend>
              {(["researcher", "analyst"] as const).map(value => (
                <button type="button" key={value} aria-pressed={audience === value}
                  onClick={() => setAudience(value)}
                  className={"min-h-10 rounded-md border px-3 py-2 text-xs font-semibold " +
                    (audience === value ? "border-[#244c37] bg-[#244c37] text-white" : "border-[#ccd8ce] bg-white text-[#48604e]")}>
                  {value === "researcher" ? "Researcher" : "Analyst"}
                </button>
              ))}
            </fieldset>
            <p className="w-full text-xs text-[#718076]">Grades describe VialGrade&apos;s source documentation, not peptide quality or effectiveness.</p>
          </div>
        </details>
        <div className="flex items-center justify-between gap-3">
          <p role="status" className="text-xs font-medium text-[#637268]">
            Showing {matching.length} of {RESEARCH_SUBJECTS.length} compounds
            {themeId === "all" ? "" : " · " + researchThemeById(themeId).name}
          </p>
          <Link href="/intelligence/grading" className="text-xs font-medium text-[#347352] underline underline-offset-4">About file coverage</Link>
        </div>
      </section>

      {matching.length === 0 ? (
        <section className="rounded-xl border border-[#d8e2d9] bg-white px-6 py-12 text-center">
          <h3 className="text-lg font-bold text-[#253829]">No matching compounds</h3>
          <p className="mt-2 text-sm text-[#6a786c]">Try a different name or clear the filters. This is a curated research library, not a complete catalog.</p>
          <button type="button" onClick={clear} className="mt-5 rounded-lg bg-[#244c37] px-4 py-2.5 text-sm font-semibold text-white">Show all records</button>
        </section>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {matching.map(subject => {
            const isSelected = selected.includes(subject.slug);
            const atLimit = !isSelected && selected.length >= 3;
            return (
              <article key={subject.slug} data-testid="research-card"
                className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#d8e3d9] bg-white transition-colors hover:border-[#82ae8d] hover:shadow-[0_6px_18px_rgba(22,47,32,.06)]">
                <ResearchSubjectArt subject={subject} compact />
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex flex-wrap items-start justify-between gap-1.5">
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-[11px] text-[#68796d]">{subject.family}</p>
                      <h3 className="mt-0.5 text-lg font-bold leading-tight tracking-[-.03em] text-[#203628]">{subject.name}</h3>
                    </div>
                    {subject.sampleTrial && <span className="rounded bg-[#ecf5ed] px-2 py-1 text-[10px] font-semibold text-[#3a7050]">Trial on file</span>}
                  </div>
                  <p className="mt-3 line-clamp-2 min-h-10 text-xs leading-5 text-[#647369]">{subject.identity}</p>
                  <div className="mt-2"><ResearchFileGradeMark subject={subject} withCount /></div>
                  <p className="mt-3 line-clamp-2 flex-1 text-xs leading-5 text-[#4e6254]">{audience === "researcher" ? subject.studyQuestion : subject.analystAngle}</p>
                  <div className="mt-4 flex items-center gap-2 border-t border-[#e9eeea] pt-3">
                    <Link href={"/intelligence/explore/" + subject.slug}
                      aria-label={"Open research dossier: " + subject.name}
                      className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg bg-[#264e36] px-2 text-xs font-semibold text-white hover:bg-[#386847]">
                      View details <ArrowRight className="size-3.5" />
                    </Link>
                    <button type="button" onClick={() => setQuickViewSlug(subject.slug)}
                      aria-label={"Quick view " + subject.name} title="Quick view"
                      className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#c8d9cd] px-3 text-xs font-semibold text-[#315b43] hover:bg-[#f0f7f1]">
                      Quick view
                    </button>
                    <button type="button" disabled={atLimit}
                      aria-pressed={isSelected} aria-label={(isSelected ? "Remove " : "Compare ") + subject.name}
                      title={atLimit ? "Compare up to three compounds" : isSelected ? "Remove from comparison" : "Add to comparison"}
                      onClick={() => toggleCompare(subject.slug)}
                      className={"grid size-10 shrink-0 place-items-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-35 " +
                        (isSelected ? "border-[#4d9066] bg-[#e5f5e8] text-[#2b6d48]" : "border-[#cbdad0] text-[#43614e] hover:border-[#80a98e] hover:bg-[#f2f7f2]")}>
                      {isSelected ? <Check className="size-4" /> : <GitCompareArrows className="size-4" />}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <section aria-labelledby="research-studies-title" className="border-t border-[#e0e6df] pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="research-studies-title" className="text-lg font-bold tracking-[-.03em] text-[#24382c]">Start with an actual study</h2>
            <p className="mt-1 text-xs leading-5 text-[#6c7b70]">Five selected public trial examples. A starting point, not a ranking.</p>
          </div>
          <button type="button" onClick={() => { setSourceFilter("selected-trial"); setThemeId("all"); setQuery(""); document.getElementById("browse-title")?.scrollIntoView({ behavior: "smooth" }); }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#2f7151] hover:underline">Show trials in the library <ArrowRight className="size-3.5" /></button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {RESEARCH_SUBJECTS.filter(subject => Boolean(subject.sampleTrial)).map(subject => (
            <Link key={subject.slug} href={"/intelligence/explore/" + subject.slug} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#d8e3db] bg-white px-3 py-2 text-xs font-semibold text-[#35563f] hover:border-[#87af8f]">
              {subject.name}<span className="font-normal text-[#758779]">{subject.sampleTrial}</span><ArrowUpRight className="size-3.5" />
            </Link>
          ))}
        </div>
      </section>

      {selected.length > 0 && (
        <section aria-label="Comparison selection" className="sticky bottom-4 z-30 mx-auto max-w-[900px] rounded-xl border border-[#264e36] bg-[#243f2d] p-3 text-white shadow-[0_12px_35px_rgba(15,40,25,.22)] sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-white/80">Compare selected · {selected.length}/3</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selected.map(slug => {
                  const subject = RESEARCH_SUBJECTS.find(item => item.slug === slug)!;
                  return (
                    <button key={slug} type="button" onClick={() => toggleCompare(slug)}
                      aria-label={"Remove " + subject.name}
                      className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold hover:bg-white/25">
                      {subject.name} <X className="size-3" />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setSelected([])} className="rounded-lg px-3 py-2 text-xs font-medium text-white/85 hover:text-white">Clear</button>
              <Link aria-disabled={selected.length < 2} href={selected.length < 2 ? "#" : compareExplorerHref(selected, audience)}
                onClick={event => { if (selected.length < 2) event.preventDefault(); }}
                className={"inline-flex min-h-10 items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold " +
                  (selected.length >= 2 ? "bg-white text-[#28472f] hover:bg-[#f1f8ef]" : "cursor-not-allowed bg-white/20 text-white/70")}>
                Compare subjects <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
          {selected.length < 2 && <p className="mt-2 text-xs text-white/75">Add one more compound to compare their research files.</p>}
        </section>
      )}

      <ResearchQuickView subject={peek} audience={audience}
        selected={Boolean(peek && selected.includes(peek.slug))}
        compareLimitReached={selected.length >= 3}
        onClose={() => setQuickViewSlug(null)} onCompare={toggleCompare} />
    </div>
  );
}

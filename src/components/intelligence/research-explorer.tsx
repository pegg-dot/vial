"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, FilterX, GitCompareArrows, Search, X } from "lucide-react";
import {
  compareExplorerHref, RESEARCH_SUBJECTS, RESEARCH_THEMES, researchThemeById,
  type ExplorerAudience, type ResearchThemeId,
} from "@/lib/research-explorer";

const themeSymbol: Record<ResearchThemeId, string> = {
  metabolic: "◉", "host-defense": "✳", neuropeptides: "◎", constrained: "⌬",
};

export function ResearchExplorer() {
  const [query, setQuery] = useState("");
  const [themeId, setThemeId] = useState<ResearchThemeId | "all">("all");
  const [audience, setAudience] = useState<ExplorerAudience>("researcher");
  const [selected, setSelected] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);

  const matching = useMemo(() => {
    const q = query.trim().toLowerCase();
    return RESEARCH_SUBJECTS.filter(subject => {
      if (themeId !== "all" && subject.theme !== themeId) return false;
      if (!q) return true;
      const theme = researchThemeById(subject.theme);
      return [
        subject.name, subject.family, subject.mechanism, subject.studyQuestion,
        subject.identity, theme.name, ...subject.alternativeNames,
      ].some(value => value.toLowerCase().includes(q));
    });
  }, [query, themeId]);

  const featuredMode = themeId === "all" && !query.trim() && !showAll;
  const visible = featuredMode
    ? RESEARCH_THEMES.flatMap(theme => matching.filter(subject => subject.theme === theme.id).slice(0, 2))
    : matching;

  function toggleCompare(slug: string) {
    setSelected(old => old.includes(slug)
      ? old.filter(item => item !== slug)
      : old.length < 3 ? [...old, slug] : old);
  }
  function clear() { setQuery(""); setThemeId("all"); }

  return (
    <div className="space-y-9">
      <section aria-labelledby="discover-themes" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="discover-themes" className="text-lg font-semibold tracking-[-.03em] text-[#20253a]">Choose a research direction</h2>
          <span className="text-xs font-medium text-[#777b88]">4 themes · 16 curated subjects</span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {RESEARCH_THEMES.map(theme => (
            <button key={theme.id} type="button" aria-pressed={themeId === theme.id}
              onClick={() => setThemeId(old => old === theme.id ? "all" : theme.id)}
              className={"flex min-h-[145px] flex-col items-start rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(30,35,65,.06)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5f50d6] " +
                (themeId === theme.id ? "border-[#6256a7] bg-[#f2efff] ring-1 ring-[#6256a7]/35" : "border-[#e1e2ea] bg-white")}>
              <span className="flex size-10 items-center justify-center rounded-xl text-2xl" style={{ backgroundColor: theme.tint, color: theme.color }} aria-hidden="true">{themeSymbol[theme.id]}</span>
              <span className="mt-4 text-sm font-semibold leading-5 text-[#25293c]">{theme.name}</span>
              <span className="mt-1 hidden text-xs leading-5 text-[#747888] sm:block">{theme.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="browse-title" className="space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 id="browse-title" className="text-2xl font-semibold tracking-[-.045em] text-[#20253a]">Explore the research</h2>
            <p className="mt-1 text-sm leading-6 text-[#737887]">No universal rankings. Choose a question and follow the original records.</p>
          </div>
          <div aria-label="Research perspective" className="inline-flex w-fit rounded-xl border border-[#e0e2e9] bg-[#f7f7fa] p-1 text-xs font-semibold">
            <button type="button" aria-pressed={audience === "researcher"} onClick={() => setAudience("researcher")}
              className={"rounded-lg px-4 py-2.5 " + (audience === "researcher" ? "bg-white text-[#2c2b50] shadow-sm" : "text-[#797b89] hover:text-[#2d3044]")}>Researcher</button>
            <button type="button" aria-pressed={audience === "analyst"} onClick={() => setAudience("analyst")}
              className={"rounded-lg px-4 py-2.5 " + (audience === "analyst" ? "bg-white text-[#2c2b50] shadow-sm" : "text-[#797b89] hover:text-[#2d3044]")}>Analyst</button>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Search research subjects</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#868b99]" aria-hidden="true" />
            <input type="search" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search peptides, mechanisms, aliases..."
              className="h-12 w-full rounded-xl border border-[#dddfe8] bg-white pl-11 pr-4 text-sm text-[#2b2f40] outline-none placeholder:text-[#9398a5] focus:border-[#6a58aa] focus:ring-2 focus:ring-[#6a58aa]/20" />
          </label>
          <label className="flex items-center gap-2 text-sm text-[#6b6f7d]">
            <span>Theme</span>
            <select value={themeId} onChange={e => setThemeId(e.target.value as ResearchThemeId | "all")}
              className="h-12 min-w-[180px] rounded-xl border border-[#dddfe8] bg-white px-4 text-sm font-medium text-[#2b2f40] focus:border-[#6a58aa] focus:outline-2 focus:outline-offset-2 focus:outline-[#6a58aa]">
              <option value="all">All research areas</option>
              {RESEARCH_THEMES.map(theme => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-xs font-medium text-[#777b88]">
            Showing {visible.length} of {RESEARCH_SUBJECTS.length} subjects
            {themeId === "all" ? "" : " · " + researchThemeById(themeId).name}
          </p>
          {(themeId !== "all" || query) && (
            <button type="button" onClick={clear}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#594a9f] hover:underline"><FilterX className="size-3.5" /> Clear filters</button>
          )}
        </div>

        {matching.length === 0 ? (
          <div className="rounded-2xl border border-[#e0e1e9] bg-white p-12 text-center">
            <h3 className="text-lg font-semibold text-[#282a3d]">Nothing matches these filters.</h3>
            <p className="mt-2 text-sm text-[#747887]">This is a curated starter collection, not a complete peptide database.</p>
            <button type="button" onClick={clear} className="mt-4 rounded-lg bg-[#29264b] px-4 py-2.5 text-sm font-semibold text-white">Show all research</button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map(subject => {
              const theme = researchThemeById(subject.theme);
              const isSelected = selected.includes(subject.slug);
              const atLimit = !isSelected && selected.length >= 3;
              return (
                <article key={subject.slug} className="group relative flex min-w-0 flex-col overflow-hidden rounded-[18px] border border-[#dfe1e9] bg-white shadow-[0_4px_18px_rgba(35,40,75,.025)] transition-all hover:-translate-y-0.5 hover:border-[#c7c4e5] hover:shadow-[0_12px_26px_rgba(35,40,75,.065)]">
                  <div className="relative flex h-24 items-center justify-between overflow-hidden px-5" style={{ background: "linear-gradient(125deg, " + theme.tint + ", #ffffff)" }}>
                    <div className="absolute -right-6 -top-14 size-44 rounded-full border border-white/70" aria-hidden="true">
                      <div className="absolute left-12 top-10 size-16 rounded-full border border-white/85" />
                      <div className="absolute left-5 top-26 size-4 rounded-full" style={{ backgroundColor: theme.color, opacity: 0.13 }} />
                      <div className="absolute right-7 top-12 size-3 rounded-full" style={{ backgroundColor: theme.color, opacity: 0.23 }} />
                    </div>
                    <span className="relative rounded-full border border-white/90 bg-white/75 px-3 py-1 text-[11px] font-semibold" style={{ color: theme.color }}>{theme.short}</span>
                    <span className="relative flex size-10 items-center justify-center rounded-full bg-white/75 text-2xl" style={{ color: theme.color }} aria-hidden="true">{themeSymbol[theme.id]}</span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-[11px] font-medium uppercase tracking-[.09em] text-[#898b97]">{subject.family}</p>
                    <h3 className="mt-2 text-xl font-semibold tracking-[-.035em] text-[#25293b]">{subject.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#6e7281]">{subject.identity}</p>
                    <div className="mt-4 flex-1 rounded-xl bg-[#f8f8fb] p-3.5">
                      <p className="text-[11px] font-bold uppercase tracking-[.1em] text-[#857d9e]">{audience === "researcher" ? "Research question" : "Diligence perspective"}</p>
                      <p className="mt-1.5 text-sm leading-6 text-[#3d4254]">{audience === "researcher" ? subject.studyQuestion : subject.analystAngle}</p>
                    </div>
                    <div className="mt-5 flex items-center justify-between gap-2">
                      <Link href={"/intelligence/explore/" + subject.slug} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-[#5445a4] hover:underline">
                        View evidence <ArrowUpRight className="size-4" />
                      </Link>
                      <button type="button" disabled={atLimit} title={atLimit ? "Compare up to three subjects" : undefined}
                        aria-label={(isSelected ? "Remove " : "Compare ") + subject.name} aria-pressed={isSelected}
                        onClick={() => toggleCompare(subject.slug)}
                        className={"inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors " +
                          (isSelected ? "border-[#7062b5] bg-[#f0edff] text-[#4f4098]" : "border-[#e1e2e8] bg-white text-[#656879] hover:bg-[#f7f6ff] disabled:cursor-not-allowed disabled:opacity-35")}>
                        {isSelected ? <Check className="size-3.5" /> : <GitCompareArrows className="size-3.5" />}
                        {isSelected ? "Selected" : "Compare"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {featuredMode && (
          <div className="flex flex-col items-center gap-2 py-5">
            <button type="button" onClick={() => setShowAll(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d9d7e6] bg-white px-6 py-3 text-sm font-semibold text-[#554895] hover:bg-[#f5f2ff]">
              Browse all 16 research subjects <ArrowRight className="size-4" />
            </button>
            <p className="text-center text-xs leading-5 text-[#898b98]">Eight starting points across all four themes. No scientific ranking is implied.</p>
          </div>
        )}
      </section>

      {selected.length > 0 && (
        <section aria-label="Comparison selection" className="sticky bottom-4 z-30 mx-auto max-w-[920px] rounded-2xl border border-[#575078]/20 bg-[#272441] p-3 text-white shadow-[0_15px_45px_rgba(27,24,58,.22)] sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white/60">COMPARE · {selected.length}/3</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {selected.map(slug => {
                  const subject = RESEARCH_SUBJECTS.find(item => item.slug === slug)!;
                  return <button key={slug} type="button" onClick={() => toggleCompare(slug)} aria-label={"Remove " + subject.name}
                    className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-medium hover:bg-white/20">
                    {subject.name} <X className="size-3" />
                  </button>;
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setSelected([])} className="rounded-md px-3 py-2 text-xs font-semibold text-white/70 hover:text-white">Clear</button>
              <Link aria-disabled={selected.length < 2}
                href={selected.length < 2 ? "#" : compareExplorerHref(selected, audience)}
                onClick={event => { if (selected.length < 2) event.preventDefault(); }}
                className={"inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold " +
                  (selected.length >= 2 ? "bg-white text-[#292441] hover:bg-[#eeedff]" : "cursor-not-allowed bg-white/30 text-white/70")}>
                Compare subjects <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
          {selected.length < 2 && <p className="mt-2 text-xs text-white/65">Select one more subject to compare research questions and source identity.</p>}
        </section>
      )}
    </div>
  );
}

import { RESEARCH_SUBJECTS, RESEARCH_THEMES, type ExplorerAudience, type ResearchThemeId } from "@/lib/research-explorer";

export type SourceFilter = "all" | "selected-trial" | "identity-only";
export type GradeFilter = "all" | "A" | "B" | "C" | "ungraded";
export type SortMode = "editorial" | "source-coverage";

export type ExplorerState = {
  query: string;
  theme: ResearchThemeId | "all";
  audience: ExplorerAudience;
  source: SourceFilter;
  grade: GradeFilter;
  sort: SortMode;
  compare: string[];
};

export const DEFAULT_EXPLORER_STATE: ExplorerState = {
  query: "", theme: "all", audience: "researcher", source: "all", grade: "all", sort: "editorial", compare: [],
};

export const MAX_COMPARE = 3;

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const oneOf = <T extends string>(value: string, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

/**
 * Explorer state lives in the URL so the browser Back button restores it after opening a dossier.
 * Every value is checked against a fixed list, so a hand-edited URL falls back to the default
 * instead of reaching the component as an arbitrary string.
 */
export function parseExplorerState(raw: RawParams): ExplorerState {
  const known = new Set(RESEARCH_SUBJECTS.map(subject => subject.slug));
  const compare = first(raw.compare).split(",").filter((slug, i, all) => known.has(slug) && all.indexOf(slug) === i);
  return {
    query: first(raw.q).slice(0, 80),
    theme: oneOf(first(raw.theme), ["all", ...RESEARCH_THEMES.map(theme => theme.id)] as const, "all"),
    audience: oneOf(first(raw.view), ["researcher", "analyst"] as const, "researcher"),
    source: oneOf(first(raw.src), ["all", "selected-trial", "identity-only"] as const, "all"),
    grade: oneOf(first(raw.grade), ["all", "A", "B", "C", "ungraded"] as const, "all"),
    sort: oneOf(first(raw.sort), ["editorial", "source-coverage"] as const, "editorial"),
    compare: compare.slice(0, MAX_COMPARE),
  };
}

/** Only non-default values are written, so the unfiltered page keeps its clean URL. */
export function serializeExplorerState(state: ExplorerState): string {
  const d = DEFAULT_EXPLORER_STATE;
  const params = new URLSearchParams();
  if (state.query.trim()) params.set("q", state.query.trim().slice(0, 80));
  if (state.theme !== d.theme) params.set("theme", state.theme);
  if (state.audience !== d.audience) params.set("view", state.audience);
  if (state.source !== d.source) params.set("src", state.source);
  if (state.grade !== d.grade) params.set("grade", state.grade);
  if (state.sort !== d.sort) params.set("sort", state.sort);
  if (state.compare.length) params.set("compare", state.compare.join(","));
  return params.toString();
}

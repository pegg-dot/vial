"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ExternalLink, Filter, Search, X } from "lucide-react";
import {
  NEWS_TOPICS,
  classifyNewsTopics,
  filterNews,
  hasActiveNewsFilters,
  type NewsRow,
  type NewsTopicId,
} from "@/lib/news-filter";

// Ten at a time. The feed is a reading surface, not a table — a reader scans a handful, decides
// whether the thread is worth following, and asks for more. Rendering all 80 at once made the page
// a wall and gave no way to answer "has anything happened to MY vendor".
const PAGE = 10;

// Source-type honesty: government/court/trade records are primary and high-confidence; blogs/forums
// are industry chatter and clearly marked as such so a reader weights them accordingly.
export const SOURCE_META: Record<string, { label: string; cls: string; note: string }> = {
  trade: { label: "Official record", cls: "bg-[#e6fbf6] text-[#0e8f80]", note: "Primary government, court, or regulatory document" },
  news: { label: "News", cls: "bg-[#eaf3ff] text-[#2b31d8]", note: "Reported by an established news outlet" },
  blog: { label: "Industry blog", cls: "bg-[#fff6e6] text-[#b26a00]", note: "Industry tracker/blog — not independently verified" },
  forum: { label: "Forum", cls: "bg-[#fff6e6] text-[#b26a00]", note: "Community/forum report — treat as unconfirmed" },
};

const SOURCE_ORDER = ["trade", "news", "blog", "forum"];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function NewsFeed({ items, initialQuery = "", initialSourceTypes = [], initialTopics = [] }: {
  items: NewsRow[];
  initialQuery?: string;
  initialSourceTypes?: string[];
  initialTopics?: NewsTopicId[];
}) {
  const [query, setQuery] = useState(initialQuery);
  const [sourceTypes, setSourceTypes] = useState<string[]>(initialSourceTypes);
  const [topics, setTopics] = useState<NewsTopicId[]>(initialTopics);
  const [visible, setVisible] = useState(PAGE);

  const filters = useMemo(() => ({ query, sourceTypes, topics }), [query, sourceTypes, topics]);
  const results = useMemo(() => filterNews(items, filters), [items, filters]);

  // Only offer a facet that can actually return something. A chip that matches nothing in the
  // current feed is a dead control — it reads as "no results" when the truth is "never any".
  const sourceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) counts.set(item.source_type, (counts.get(item.source_type) ?? 0) + 1);
    return counts;
  }, [items]);
  const topicCounts = useMemo(() => {
    const counts = new Map<NewsTopicId, number>();
    for (const item of items) for (const topic of classifyNewsTopics(item)) counts.set(topic, (counts.get(topic) ?? 0) + 1);
    return counts;
  }, [items]);

  // Keep the URL in step so a filtered view can be linked or reloaded. replaceState rather than a
  // router push: the filtering is entirely client-side, and pushing per keystroke would bury the
  // back button under one entry per character.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    for (const type of sourceTypes) params.append("source", type);
    for (const topic of topics) params.append("topic", topic);
    const search = params.toString();
    window.history.replaceState(null, "", search ? `${window.location.pathname}?${search}` : window.location.pathname);
  }, [query, sourceTypes, topics]);

  // Every filter change re-pages from the top. Done in the mutators rather than an effect so the
  // reset lands in the same render as the filter change — leaving `visible` where it was would
  // silently show a reader the 40th match of a fresh search.
  function applyQuery(next: string) { setQuery(next); setVisible(PAGE); }
  function applySourceType(type: string) { setSourceTypes((current) => toggle(current, type)); setVisible(PAGE); }
  function applyTopic(id: NewsTopicId) { setTopics((current) => toggle(current, id)); setVisible(PAGE); }
  function addTopic(id: NewsTopicId) { setTopics((current) => (current.includes(id) ? current : [...current, id])); setVisible(PAGE); }

  const active = hasActiveNewsFilters(filters);
  const shown = results.slice(0, visible);
  const remaining = results.length - shown.length;

  function reset() {
    setQuery("");
    setSourceTypes([]);
    setTopics([]);
    setVisible(PAGE);
  }

  return (
    <>
      <section aria-label="Filter the news feed" data-testid="news-filters" className="ink hard rounded-[20px] bg-white p-5 sm:p-6">
        <div className="flex items-center gap-3 rounded-[14px] border-[1.5px] border-[#111214] bg-[var(--background)] px-4 py-3 focus-within:shadow-[3px_3px_0_#2b31d8]">
          <Search className="size-4 shrink-0 text-[var(--muted)]" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => applyQuery(event.target.value)}
            placeholder="Search a vendor, compound, agency, or publisher"
            aria-label="Search news"
            className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:font-normal placeholder:text-[var(--muted)]"
          />
          {query && (
            <button onClick={() => applyQuery("")} aria-label="Clear search" className="ink-1 rounded-full bg-white p-1.5 text-[var(--muted)] transition hover:text-[#111214]">
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="mt-5 space-y-4">
          <Facets label="Source" hint="How much weight the record deserves">
            {SOURCE_ORDER.filter((type) => sourceCounts.get(type)).map((type) => {
              const meta = SOURCE_META[type];
              const on = sourceTypes.includes(type);
              return (
                <Chip key={type} on={on} title={meta.note} onClick={() => applySourceType(type)}>
                  {meta.label} <span className="tabular-nums opacity-60">{sourceCounts.get(type)}</span>
                </Chip>
              );
            })}
          </Facets>

          <Facets label="Topic" hint="Grouped from each headline and summary by VialGrade — not a label the publisher applied">
            {NEWS_TOPICS.filter((topic) => topicCounts.get(topic.id)).map((topic) => {
              const on = topics.includes(topic.id);
              return (
                <Chip key={topic.id} on={on} title={topic.note} onClick={() => applyTopic(topic.id)}>
                  {topic.label} <span className="tabular-nums opacity-60">{topicCounts.get(topic.id)}</span>
                </Chip>
              );
            })}
          </Facets>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t-2 border-[#111214] pt-4">
          <p className="text-sm font-bold tabular-nums" data-testid="news-count">
            {results.length} {results.length === 1 ? "record" : "records"}
            {active && <span className="font-medium text-[var(--muted)]"> of {items.length}</span>}
          </p>
          {active && (
            <button onClick={reset} className="ink-1 press inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold">
              <Filter className="size-3" /> Clear filters
            </button>
          )}
        </div>
      </section>

      {results.length === 0 ? (
        <div className="ink hard mt-6 rounded-[20px] bg-white px-6 py-16 text-center">
          <p className="text-lg font-extrabold">Nothing on record matches that.</p>
          <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-[var(--muted)]">
            We only publish items we can point at a source for, so the feed is deliberately narrow. Try a vendor
            name, a compound, or an agency.
          </p>
          <button onClick={reset} className="ink hard-sm press mt-6 rounded-full bg-[#111214] px-5 py-2.5 text-sm font-bold text-white">Clear filters</button>
        </div>
      ) : (
        <>
          <ol className="mt-6 space-y-3">
            {shown.map((n) => {
              const meta = SOURCE_META[n.source_type] ?? SOURCE_META.news;
              const rowTopics = classifyNewsTopics(n);
              return (
                <li key={n.id} className="ink-1 hard rounded-[18px] bg-white p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`ink-1 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${meta.cls}`}>{meta.label}</span>
                    {n.news_date && <span className="text-[11px] font-bold tabular-nums text-[var(--muted)]">{n.news_date}</span>}
                    {n.publisher && <span className="text-[11px] font-semibold text-[var(--muted)]">· {n.publisher}</span>}
                    {/* vendor_name comes from a LEFT JOIN, so it is null exactly when we do not
                        hold that vendor. Linking on the SLUG alone published a dead link on the
                        DOJ guilty-plea item — the single entry on this page whose credibility
                        matters most. Name it either way; only link when there is a page to reach. */}
                    {n.vendor_slug && n.vendor_name && (
                      <Link href={`/vendors/${n.vendor_slug}`} className="ink-1 ml-auto inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#111214] transition hover:-translate-y-0.5">
                        {n.vendor_name} <ArrowUpRight className="size-3" />
                      </Link>
                    )}
                    {n.vendor_slug && !n.vendor_name && (
                      <span className="ink-1 ml-auto inline-flex items-center rounded-full bg-[#f7f7f4] px-2.5 py-1 text-[11px] font-bold text-[var(--muted)]" title="Named in this record. We do not track this vendor.">
                        {n.vendor_slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-3 text-xl font-extrabold leading-6 tracking-[-.02em]">{n.title}</h2>
                  <p className="mt-2 text-sm font-medium leading-6 text-black/70">{n.summary}</p>
                  {rowTopics.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {rowTopics.map((id) => {
                        const topic = NEWS_TOPICS.find((item) => item.id === id)!;
                        return (
                          <button
                            key={id}
                            onClick={() => addTopic(id)}
                            title={`Filter to: ${topic.note}`}
                            className="ink-1 rounded-full bg-[#fff3f1] px-2.5 py-1 text-[10px] font-bold text-[#d3372c] transition hover:-translate-y-0.5"
                          >
                            {topic.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-[11px] font-semibold text-[var(--muted)]">{meta.note}</span>
                    <a href={n.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-black/45 hover:text-black">source <ExternalLink className="size-3" /></a>
                  </div>
                </li>
              );
            })}
          </ol>

          {remaining > 0 ? (
            <div className="mt-6 flex flex-col items-center gap-2">
              <button
                onClick={() => setVisible((current) => current + PAGE)}
                className="ink hard press rounded-full bg-white px-6 py-3 text-sm font-bold"
              >
                Show {Math.min(PAGE, remaining)} more
              </button>
              <p className="text-xs font-medium tabular-nums text-[var(--muted)]">Showing {shown.length} of {results.length}</p>
            </div>
          ) : (
            results.length > PAGE && <p className="mt-6 text-center text-xs font-medium text-[var(--muted)]">That is every record we hold{active ? " for this filter" : ""}.</p>
          )}
        </>
      )}
    </>
  );
}

function Facets({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  if (Array.isArray(items) && items.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--muted)]" title={hint}>{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">{items}</div>
    </div>
  );
}

function Chip({ on, title, onClick, children }: { on: boolean; title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={`ink-1 press inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${on ? "bg-[#111214] text-white" : "bg-white text-[#111214]"}`}
    >
      {children}
    </button>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ExternalLink, Filter, Search, X } from "lucide-react";
import {
  NEWS_TOPICS,
  SOURCE_META,
  classifyNewsTopics,
  filterNews,
  hasActiveNewsFilters,
  leadFirst,
  type NewsRow,
  type NewsTopicId,
} from "@/lib/news-filter";

// Ten at a time. The feed is a reading surface, not a table — a reader scans a handful, decides
// whether the thread is worth following, and asks for more. Rendering all 80 at once made the page
// a wall and gave no way to answer "has anything happened to MY vendor".
const PAGE = 10;

const SOURCE_ORDER = ["trade", "news", "blog", "forum"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// String math on the stored YYYY-MM-DD — a Date() round-trip would shift the day in some timezones.
function prettyDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}, ${m[1]}`;
}

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
  // A story's topic pills toggle, exactly like the facet chips above them. They used to only ADD,
  // which made an already-active pill a dead control — and once it advertised `aria-pressed` that
  // became a promise the handler did not keep.
  function addTopic(id: NewsTopicId) { applyTopic(id); }

  const active = hasActiveNewsFilters(filters);

  // An unconfirmed forum post must never inherit the lead slot's 44px headline — see `leadFirst`.
  const ordered = useMemo(() => leadFirst(results), [results]);

  const shown = ordered.slice(0, visible);
  const remaining = results.length - shown.length;

  function reset() {
    setQuery("");
    setSourceTypes([]);
    setTopics([]);
    setVisible(PAGE);
  }

  return (
    <>
      {/* A slim masthead bar, not a filter billboard — the stories are the page. */}
      <section aria-label="Filter the news feed" data-testid="news-filters" className="border-b-2 border-[#111214] pb-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
          <div className="ink-1 flex min-w-[15rem] flex-1 items-center gap-2.5 rounded-full bg-white px-4 py-2.5 focus-within:shadow-[3px_3px_0_#d3372c]">
            <Search className="size-4 shrink-0 text-[var(--muted)]" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => applyQuery(event.target.value)}
              placeholder="Search a vendor, compound, agency, or publisher"
              aria-label="Search news"
              className="min-w-0 flex-1 bg-transparent text-[14px] font-medium outline-none placeholder:font-normal placeholder:text-[var(--muted)]"
            />
            {query && (
              <button onClick={() => applyQuery("")} aria-label="Clear search" className="ink-1 rounded-full bg-white p-1 text-[var(--muted)] transition hover:text-[#111214]">
                <X className="size-3" />
              </button>
            )}
          </div>
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

        <div className="mt-3 flex flex-col gap-2">
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
          {/* A front page, not a stack of identical boxes: the newest record runs as the lead, the
              next four form a two-column tier, and everything older compresses into headline rows.
              Rules do the separating — the frames are gone. */}
          <ol className="grid grid-cols-1 gap-x-10 lg:grid-cols-2">
            {shown.map((n, i) => (
              <NewsItem key={n.id} item={n} tier={i === 0 ? "lead" : i <= 4 ? "second" : "row"} kicker={i === 5} onTopic={addTopic} activeTopics={topics} />
            ))}
          </ol>

          {remaining > 0 ? (
            <div className="mt-8 flex flex-col items-center gap-2">
              <button
                onClick={() => setVisible((current) => current + PAGE)}
                className="ink hard press rounded-full bg-white px-6 py-3 text-sm font-bold"
              >
                Show {Math.min(PAGE, remaining)} more
              </button>
              <p className="text-xs font-medium tabular-nums text-[var(--muted)]">Showing {shown.length} of {results.length}</p>
            </div>
          ) : (
            results.length > PAGE && <p className="mt-8 text-center text-xs font-medium text-[var(--muted)]">That is every record we hold{active ? " for this filter" : ""}.</p>
          )}
        </>
      )}
    </>
  );
}

// The vendor a record names, linked only when we hold a page for it. vendor_name comes from a LEFT
// JOIN, so it is null exactly when we do not track that vendor — linking on the slug alone once
// published a dead link on the DOJ guilty-plea item, the single entry whose credibility matters most.
function VendorChip({ item }: { item: NewsRow }) {
  if (item.vendor_slug && item.vendor_name) {
    return (
      <Link href={`/vendors/${item.vendor_slug}`} className="ink-1 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-[#111214] transition hover:-translate-y-0.5">
        {item.vendor_name} <ArrowUpRight className="size-3" />
      </Link>
    );
  }
  if (item.vendor_slug) {
    return (
      <span className="ink-1 inline-flex items-center rounded-full bg-[#f7f7f4] px-2.5 py-0.5 text-[11px] font-bold text-[var(--muted)]" title="Named in this record. We do not track this vendor.">
        {item.vendor_slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
      </span>
    );
  }
  return null;
}

// `inline` drops the wrapper so the pills join a flex row that already exists (the second tier
// sits them beside the vendor chip). Two display utilities on one element would collide.
function TopicRow({ item, onTopic, activeTopics, inline = false }: { item: NewsRow; onTopic: (id: NewsTopicId) => void; activeTopics: NewsTopicId[]; inline?: boolean }) {
  const rowTopics = classifyNewsTopics(item);
  if (rowTopics.length === 0) return null;
  const pills = rowTopics.map((id) => {
    const topic = NEWS_TOPICS.find((t) => t.id === id)!;
    const on = activeTopics.includes(id);
    return (
      <button
        key={id}
        onClick={() => onTopic(id)}
        title={on ? `Stop filtering to: ${topic.note}` : `Filter to: ${topic.note}`}
        aria-pressed={on}
        className={`ink-1 rounded-full px-2.5 py-1 text-[10px] font-bold transition hover:-translate-y-0.5 ${on ? "bg-[#d3372c] text-white" : "bg-[#fff3f1] text-[#d3372c]"}`}
      >
        {topic.label}
      </button>
    );
  });
  if (inline) return <>{pills}</>;
  return <div className="mt-3 flex flex-wrap items-center gap-1.5">{pills}</div>;
}

function NewsItem({ item: n, tier, kicker, onTopic, activeTopics }: {
  item: NewsRow;
  tier: "lead" | "second" | "row";
  kicker: boolean;
  onTopic: (id: NewsTopicId) => void;
  activeTopics: NewsTopicId[];
}) {
  const meta = SOURCE_META[n.source_type] ?? SOURCE_META.news;
  const date = prettyDate(n.news_date);

  if (tier === "lead") {
    return (
      <li className="border-b-2 border-[#111214] pb-7 pt-6 lg:col-span-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`ink-1 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${meta.cls}`} title={meta.note}>{meta.label}</span>
          {date && <span className="text-[12px] font-bold tabular-nums text-[var(--muted)]">{date}</span>}
          {n.publisher && <span className="text-[12px] font-semibold text-[var(--muted)]">· {n.publisher}</span>}
          <span className="ml-auto"><VendorChip item={n} /></span>
        </div>
        <h2 className="mt-4 max-w-4xl text-balance text-[clamp(1.7rem,4vw,2.75rem)] font-extrabold leading-[1.02] tracking-[-.04em]">
          <a href={n.source_url} target="_blank" rel="noopener noreferrer" className="transition hover:text-[#d3372c]">
            {n.title}&nbsp;<ExternalLink className="mb-1 inline size-5 text-[#111214]/30" aria-hidden="true" />
          </a>
        </h2>
        <p className="mt-4 max-w-3xl text-base font-medium leading-7 text-[#111214]/70">{n.summary}</p>
        <TopicRow item={n} onTopic={onTopic} activeTopics={activeTopics} />
        <p className="mt-3 text-[11px] font-semibold text-[var(--muted)]">{meta.note}</p>
      </li>
    );
  }

  if (tier === "second") {
    return (
      <li className="border-b border-[#111214]/10 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`ink-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.cls}`} title={meta.note}>{meta.label}</span>
          {date && <span className="text-[11px] font-bold tabular-nums text-[var(--muted)]">{date}</span>}
          {n.publisher && <span className="truncate text-[11px] font-semibold text-[var(--muted)]">· {n.publisher}</span>}
        </div>
        <h2 className="mt-2.5 text-lg font-extrabold leading-6 tracking-[-.02em]">
          <a href={n.source_url} target="_blank" rel="noopener noreferrer" className="transition hover:text-[#d3372c]">
            {n.title}&nbsp;<ExternalLink className="mb-0.5 inline size-3.5 text-[#111214]/30" aria-hidden="true" />
          </a>
        </h2>
        <p className="mt-1.5 line-clamp-2 text-[13px] font-medium leading-5 text-[var(--muted)]">{n.summary}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <VendorChip item={n} />
          {/* The topic pills are filter controls, not decoration — every card used to carry them,
              and dropping them everywhere but the lead would quietly retire a working affordance. */}
          <TopicRow item={n} onTopic={onTopic} activeTopics={activeTopics} inline />
        </div>
      </li>
    );
  }

  return (
    <li className="border-b border-[#111214]/10 lg:col-span-2">
      {/* The first compressed row carries the tier's kicker, so the shift from stories to
          headlines is announced once instead of guessed at. */}
      {kicker && <p className="pt-5 text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">Earlier, on the record</p>}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
        <h2 className="min-w-0 flex-1 basis-64 text-[15px] font-bold leading-5 tracking-[-.01em]">
          <a href={n.source_url} target="_blank" rel="noopener noreferrer" className="transition hover:text-[#d3372c]">{n.title}</a>
        </h2>
        <span className="flex shrink-0 items-center gap-2">
          <VendorChip item={n} />
          <span className={`ink-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.cls}`} title={meta.note}>{meta.label}</span>
          {date && <span className="text-[11px] font-bold tabular-nums text-[var(--muted)]">{date}</span>}
        </span>
      </div>
    </li>
  );
}

function Facets({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  if (Array.isArray(items) && items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <p className="w-14 shrink-0 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--muted)]" title={hint}>{label}</p>
      {items}
    </div>
  );
}

function Chip({ on, title, onClick, children }: { on: boolean; title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={`ink-1 press inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition ${on ? "bg-[#111214] text-white" : "bg-white text-[#111214]"}`}
    >
      {children}
    </button>
  );
}

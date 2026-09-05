"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, Factory, Filter, Search, ShieldAlert, Store, X } from "lucide-react";
import { VendorMark } from "@/components/vendor-mark";
import { DataOriginBadge } from "@/components/data-origin-badge";
import { VialGradeMark } from "@/components/vial-grade-card";
import { PRIORITIES, rankVendors, type VendorDirectoryEntry } from "@/lib/vendor-ranking";
import { filterVendorEntries, hasActiveVendorFilters, offeredVendorKinds } from "@/lib/vendor-directory-filter";
import { vendorClaimLabelShort } from "@/lib/vendor-copy";
import type { Vendor } from "@/lib/types";

// Rows, not cards: a leaderboard row costs a fraction of a card's height, so the page size can
// triple and the reader still scrolls less than before.
const PAGE = 30;

// The ledger's stat columns. Every width is shared by the header and the rows — the columns are
// flex cells, so one constant keeps them aligned.
const COLS = [
  { key: "grade", label: "Grade", w: "w-[5.4rem]", align: "center" },
  { key: "tests", label: "Tests", w: "w-12" },
  { key: "purity", label: "Purity", w: "w-[4.2rem]" },
  { key: "listings", label: "Listings", w: "w-[4.2rem]" },
  { key: "price", label: "Vs market", w: "w-[5.7rem]" },
  { key: "buyers", label: "Buyers", w: "w-[4.8rem]" },
] as const;
type ColKey = (typeof COLS)[number]["key"];

// Which column the chosen priority ranks on, highlighted so the ordering is legible the way a
// market terminal marks its sort column.
//
// "reliable" is deliberately absent. Its sort key is a composite of tests, purity, reputation and
// flags that this site never displays as a number (see `reliabilityScore`), so pointing an arrow
// at any one column would claim the ranking is that column — it isn't. It gets a sentence instead.
const ACTIVE_COL: Record<string, ColKey> = { price: "price", purity: "purity", tested: "tests", reputation: "buyers" };

const SENTIMENT: Record<string, { word: string; spoken: string; cls: string }> = {
  positive: { word: "Positive", spoken: "positive buyer reports", cls: "text-[#0e8f80]" },
  mixed: { word: "Mixed", spoken: "mixed buyer reports", cls: "text-[#b26a00]" },
  negative: { word: "Negative", spoken: "negative buyer reports", cls: "text-[#d3372c]" },
  scam: { word: "Scam", spoken: "scam reports on file", cls: "text-[#d3372c]" },
};

// The most specific known reason a vendor is flagged, from the composed verdict — so the directory
// and the vendor page can never disagree about how serious a vendor is.
function redFlagLabel(entry: VendorDirectoryEntry): string | null {
  if (entry.verdict !== "avoid" && entry.verdict !== "caution") return null;
  return entry.enforcement === "severe" ? "Enforcement action"
    : entry.defunct ? "Appears defunct"
    : entry.reviewSentiment === "scam" ? "Scam reports"
    : entry.reviewSentiment === "negative" ? "Negative reviews"
    : entry.integrityFlagged ? "COA integrity flag"
    : entry.enforcement === "caution" ? "Regulatory record"
    : entry.reviewSentiment === "mixed" ? "Mixed reviews"
    : entry.verdict === "avoid" ? "Flagged — see verify" : "Proceed with caution";
}

function RedFlag({ entry }: { entry: VendorDirectoryEntry }) {
  const label = redFlagLabel(entry);
  if (!label) return null;
  const amber = entry.verdict === "caution";
  return <span className={`ink-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${amber ? "bg-[#fff4e0] text-[#b26a00]" : "bg-[#fff1f0] text-[#d3372c]"}`}><ShieldAlert className="size-3" /> {label}</span>;
}

/**
 * Why this vendor carries no letter — never a bare blank.
 *
 * Three different honest answers land in this column, and collapsing them into one mute dash made
 * a considered "we won't rate this" read as missing data. `reference` means the grade scale does
 * not apply (a maker sells nothing here; a storefront whose catalog we never captured has nothing
 * to rate), `insufficient` means the evidence isn't there yet. Both are the site's doctrine
 * working — unproven has no letter — so each says which it is and carries the stored rationale.
 */
function gradeStandIn(vendor: Vendor): { word: string; note: string } {
  const grade = vendor.grade;
  if (!grade) return { word: "Not rated", note: "We have not graded this vendor yet." };
  if (grade.band === "reference") {
    return vendor.kind === "manufacturer"
      ? { word: "Not a shop", note: grade.rationale || "An upstream manufacturer, not a storefront you can buy from — there is nothing here to rate." }
      : { word: "No listings", note: grade.rationale || "A storefront whose catalog we have not captured, so there is nothing here to rate." };
  }
  return { word: "Not rated", note: grade.rationale || "Not enough independent evidence to publish a letter. That is not the same as finding something bad." };
}

function Dash() { return <span className="text-[13px] font-semibold text-[#111214]/25">&mdash;</span>; }

// One aligned cell, header and body alike. Below lg the numbers move into a single summary line
// under the vendor's name — a phone showed one lonely highlighted figure and nothing else.
function Cell({ col, active, children }: { col: (typeof COLS)[number]; active: boolean; children: React.ReactNode }) {
  const align = "align" in col && col.align === "center" ? "justify-center" : "justify-end";
  const isGrade = col.key === "grade";
  return (
    <span className={`${col.w} shrink-0 items-center py-1 ${align} ${isGrade ? "flex" : "hidden lg:flex"} ${active ? "rounded-lg bg-[#eef0ff]" : ""}`}>
      {children}
    </span>
  );
}

function VendorRow({ entry, rank, activeCol }: { entry: VendorDirectoryEntry; rank: number; activeCol: ColKey | null }) {
  const v = entry.vendor;
  const flagLabel = redFlagLabel(entry);
  const flagged = entry.verdict === "avoid" || entry.verdict === "caution";
  const idx = entry.priceIndex;
  const sentiment = entry.reviewSentiment && entry.reviewSentiment !== "unknown" ? SENTIMENT[entry.reviewSentiment] : null;
  const graded = Boolean(v.grade?.letter) && v.grade?.band !== "reference";
  const standIn = graded ? null : gradeStandIn(v);

  const stat: Record<ColKey, React.ReactNode> = {
    grade: graded
      ? <VialGradeMark grade={v.grade!} vendorName={v.name} />
      : <span title={standIn!.note} className="text-[10px] font-bold uppercase tracking-[.04em] text-[#111214]/40">{standIn!.word}</span>,
    tests: v.coaCount > 0 ? <span className="text-[13px] font-extrabold tabular-nums">{v.coaCount}</span> : <Dash />,
    purity: v.medianPurity != null ? <span className="text-[13px] font-extrabold tabular-nums">{v.medianPurity.toFixed(1)}%</span> : <Dash />,
    listings: v.productCount > 0 ? <span className="text-[13px] font-extrabold tabular-nums">{v.productCount}</span> : <Dash />,
    price: idx != null
      ? <span className={`text-[13px] font-extrabold tabular-nums ${idx === 0 ? "" : idx < 0 ? "text-[#0e8f80]" : "text-[#d3372c]"}`}>{idx > 0 ? "+" : ""}{idx}%</span>
      : <Dash />,
    buyers: sentiment ? <span className={`text-[12px] font-extrabold ${sentiment.cls}`}>{sentiment.word}</span> : <Dash />,
  };

  // The phone line: every figure we hold, the ranked one first and in ink so the ordering still
  // reads on a 390px screen. Anything we don't hold is left out rather than printed as a dash.
  type CompactStat = { key: ColKey; text: string };
  const compact = ([
    v.coaCount > 0 ? { key: "tests", text: `${v.coaCount} test${v.coaCount === 1 ? "" : "s"}` } : null,
    v.medianPurity != null ? { key: "purity", text: `${v.medianPurity.toFixed(1)}% pure` } : null,
    v.productCount > 0 ? { key: "listings", text: `${v.productCount} listing${v.productCount === 1 ? "" : "s"}` } : null,
    idx != null ? { key: "price", text: `${idx > 0 ? "+" : ""}${idx}% vs market` } : null,
    sentiment ? { key: "buyers", text: `${sentiment.word} buyers` } : null,
  ] as Array<CompactStat | null>)
    .filter((item): item is CompactStat => item !== null)
    .sort((a, b) => Number(b.key === activeCol) - Number(a.key === activeCol));

  // One spoken sentence for the whole row. The visual cells are bare numbers under silent headers,
  // which a screen reader would read as "18. 99.4%. 23." with no idea what any of them are.
  const spoken = [
    `${rank}. ${v.name}`,
    v.kind === "manufacturer" ? "upstream manufacturer" : null,
    flagLabel,
    graded ? `VialGrade ${v.grade!.letter}` : standIn!.word === "Not a shop" ? "not rated — not a shop" : standIn!.word === "No listings" ? "not rated — no listings on record" : "not rated yet",
    v.coaCount > 0 ? `${v.coaCount} independent lab test${v.coaCount === 1 ? "" : "s"}` : "no lab tests on record",
    v.medianPurity != null ? `${v.medianPurity.toFixed(1)}% median tested purity` : null,
    v.productCount > 0 ? `${v.productCount} listing${v.productCount === 1 ? "" : "s"}` : null,
    idx != null ? `${Math.abs(idx)}% ${idx > 0 ? "above" : idx < 0 ? "below" : "at"} market price` : null,
    sentiment ? sentiment.spoken : null,
  ].filter(Boolean).join(", ");

  return (
    <Link
      href={`/vendors/${v.slug}`}
      aria-label={spoken}
      className={`group flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 transition sm:px-4 ${flagged ? "bg-[#fff5f4] hover:bg-[#ffe9e7]" : "hover:bg-[var(--background)]"}`}
    >
      <span aria-hidden="true" className="w-7 shrink-0 text-right text-[13px] font-extrabold tabular-nums text-[var(--muted)]">{rank}</span>
      <VendorMark initials={v.initials} accent={v.accent} size="sm" />
      {/* Deliberately NOT aria-hidden. The row's `aria-label` names the link, but hiding this block
          too would strip every vendor name out of the heading tree — and jumping heading to heading
          is how a screen-reader user scans a directory. The numeric cells below stay hidden because
          the label already says them in words. */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <h3 className="truncate text-[15px] font-extrabold leading-5 tracking-[-.02em]">{v.name}</h3>
          {v.origin === "live" && <DataOriginBadge origin="live" compact />}
          {v.kind === "manufacturer" && <span className="inline-flex items-center gap-1 rounded-full bg-[#39414e] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[.06em] text-white"><Factory className="size-2.5" /> Maker</span>}
          <RedFlag entry={entry} />
        </div>
        <p className="mt-0.5 truncate text-[11px] font-semibold text-[var(--muted)]">{vendorClaimLabelShort(v.profileStatus)}{v.location ? ` · ${v.location}` : ""}</p>
      </div>
      {COLS.map((col) => <Cell key={col.key} col={col} active={activeCol === col.key}><span aria-hidden="true">{stat[col.key]}</span></Cell>)}
      <ArrowUpRight aria-hidden="true" className="hidden size-4 shrink-0 text-[#111214]/25 transition group-hover:translate-x-0.5 group-hover:text-[#111214] sm:block" />
      {/* Below lg the columns collapse into this one line, indented under the vendor's name. It is
          a row-width child rather than part of the name block, which is only ~170px on a phone. */}
      {compact.length > 0 && (
        <p aria-hidden="true" className="w-full pl-[92px] text-[11px] font-semibold text-[var(--muted)] lg:hidden">
          {compact.map((item, i) => (
            <span
              key={item.key}
              className={`${i > 0 ? "before:mx-2 before:font-semibold before:text-[#111214]/25 before:content-['·']" : ""} ${item.key === activeCol ? "font-extrabold text-[#111214]" : ""}`}
            >
              {item.text}
            </span>
          ))}
        </p>
      )}
    </Link>
  );
}

export function VendorsDirectory({ entries }: { entries: VendorDirectoryEntry[] }) {
  const [priority, setPriority] = useState("reliable");
  const [kind, setKind] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE);
  const active = PRIORITIES.find((p) => p.key === priority)!;
  const activeCol = ACTIVE_COL[priority] ?? null;

  const filters = useMemo(() => ({ query, kind }), [query, kind]);
  const ranked = useMemo(() => rankVendors(filterVendorEntries(entries, filters), priority), [entries, filters, priority]);

  // Counts are taken over the WHOLE directory, not the current results, so a chip's number never
  // shifts under the pointer. `offeredVendorKinds` drops any kind that matches nothing (a dead
  // control that empties the list and reads as "we lost your vendors") and any kind that matches
  // everything (a button whose only effect is to redraw the same page).
  const kindOptions = useMemo(() => offeredVendorKinds(entries), [entries]);

  // Every filter change re-pages from the top. Done in the mutators rather than an effect so the
  // reset lands in the same render as the filter change — leaving `visible` where it was would
  // silently show a reader the 40th match of a fresh search. (This repo's eslint bans
  // setState-in-effect, and it is right to.)
  function applyQuery(next: string) { setQuery(next); setVisible(PAGE); }
  function applyKind(next: string) { setKind(next); setVisible(PAGE); }
  function applyPriority(next: string) { setPriority(next); setVisible(PAGE); }

  const filtered = hasActiveVendorFilters(filters);
  const shown = ranked.slice(0, visible);
  // The legend explains the exact words on screen, read back off the same function that renders
  // them, so it can never define a term no row shows. Deriving it from vendor kind instead would
  // have to re-implement `gradeStandIn`'s branches and would drift the moment either side moved.
  const standIns = useMemo(() => new Set(
    ranked.slice(0, visible)
      .filter((entry) => !entry.vendor.grade?.letter || entry.vendor.grade.band === "reference")
      .map((entry) => gradeStandIn(entry.vendor).word),
  ), [ranked, visible]);

  function reset() {
    setQuery("");
    setKind("all");
    setVisible(PAGE);
  }

  return (
    <div>
      {/* Priority selector — the pills and the question sit straight on the page, no card. */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#2b31d8]">What matters most to you?</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRIORITIES.map((p) => (
            <button key={p.key} type="button" onClick={() => applyPriority(p.key)} aria-pressed={priority === p.key}
              className={`ink-1 press rounded-full px-3.5 py-2 text-[13px] font-bold transition ${priority === p.key ? "bg-[#111214] text-white" : "bg-white text-[#111214]"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">
          <span className="font-extrabold tracking-[-.01em] text-[#111214]">&ldquo;{active.question}&rdquo;</span> {active.blurb}
          {/* Said out loud because no column can carry it: this lens weighs four signals at once,
              and a reader who sees an A- below three ungraded rows deserves to know why. */}
          {activeCol === null && <span className="text-[#111214]/55"> Ordered on tests, purity, buyer reputation and flags together &mdash; never one blended number.</span>}
        </p>
      </div>

      {/* Newcomer guidance (default lens only) — one quiet line, not a box. */}
      {priority === "reliable" && (
        <p className="mt-2.5 max-w-4xl text-[11px] font-semibold leading-5 text-[var(--muted)]">
          <span className="font-bold uppercase tracking-[.1em] text-[#2b31d8]">New to this?</span> A real vendor shows a batch-matched third-party certificate
          <span className="mx-1.5 text-[#111214]/30">·</span>a price far below everyone else is a warning, not a deal
          <span className="mx-1.5 text-[#111214]/30">·</span>everything here is research-use-only.
        </p>
      )}

      {/* One control row: search, kind, count. A buyer who arrives knowing the name — from a forum,
          a friend, a receipt — answers "is this the one that scams people?" without paging. */}
      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <div className="ink-1 flex min-w-[15rem] flex-1 items-center gap-2.5 rounded-full bg-white px-4 py-2.5 focus-within:shadow-[3px_3px_0_#111214]">
          <Search className="size-4 shrink-0 text-[var(--muted)]" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => applyQuery(event.target.value)}
            placeholder="Search a vendor by name or where it ships from"
            aria-label="Search vendors"
            className="min-w-0 flex-1 bg-transparent text-[14px] font-medium outline-none placeholder:font-normal placeholder:text-[var(--muted)]"
          />
          {query && (
            <button type="button" onClick={() => applyQuery("")} aria-label="Clear search" className="ink-1 rounded-full bg-white p-1 text-[var(--muted)] transition hover:text-[#111214]">
              <X className="size-3" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {/* "Everyone" always renders — it is the only way back to the unfiltered directory. */}
          <button type="button" onClick={() => applyKind("all")} aria-pressed={kind === "all"}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${kind === "all" ? "ink-1 bg-[#111214] text-white" : "text-[var(--muted)] hover:text-[#111214]"}`}>
            Everyone
          </button>
          {kindOptions.map((option) => (
            <button key={option.id} type="button" onClick={() => applyKind(option.id)} aria-pressed={kind === option.id} title={option.note}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${kind === option.id ? "ink-1 bg-[#111214] text-white" : "text-[var(--muted)] hover:text-[#111214]"}`}>
              {option.id === "storefront" ? <Store className="size-3.5" /> : <Factory className="size-3.5" />}{option.label}
              <span className="tabular-nums opacity-60">{option.count}</span>
            </button>
          ))}
        </div>
        {/* The bare "N vendors" stays its own element: it is the honest headline count, and the
            "of N" qualifier sits beside it rather than inside it. */}
        <p className="text-sm font-medium text-[var(--muted)]">
          <span data-testid="vendor-count"><span className="font-extrabold text-black tabular-nums">{ranked.length}</span> vendor{ranked.length === 1 ? "" : "s"}</span>
          {filtered && <span className="tabular-nums"> of {entries.length}</span>}
        </p>
        {filtered && (
          <button type="button" onClick={reset} className="ink-1 press inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold">
            <Filter className="size-3" /> Clear filters
          </button>
        )}
      </div>

      <p className="mt-2 text-[11px] font-medium text-[var(--muted)]">
        Names match with or without spacing &mdash; &ldquo;swisschems&rdquo; finds Swiss Chems. Search reads the name, URL, and location, never marketing copy.
      </p>

      {ranked.length === 0 ? (
        <div className="ink hard-sm mt-4 rounded-[16px] bg-white px-6 py-14 text-center">
          <p className="text-lg font-extrabold">No vendor on record matches that.</p>
          <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-[var(--muted)]">
            We only list sellers we hold a record for, so the directory is deliberately narrower than the market. Finding nothing here is a fact about our coverage, not a verdict on the vendor.
          </p>
          <button type="button" onClick={reset} className="ink hard-sm press mt-6 rounded-full bg-[#111214] px-5 py-2.5 text-sm font-bold text-white">Clear filters</button>
        </div>
      ) : (
        <>
          {/* The leaderboard. One ink frame around the whole ledger; inside it, rows and hairlines
              only — the boxes-inside-boxes card grid spent more pixels on frames than on facts. */}
          <div className="ink hard mt-4 overflow-hidden rounded-[18px] bg-white">
            <div className="flex items-center gap-3 border-b-2 border-[#111214] bg-[var(--background)] px-3 py-2 sm:px-4" aria-hidden="true">
              <span className="w-7 shrink-0 text-right text-[10px] font-bold uppercase tracking-[.1em] text-[var(--muted)]">#</span>
              <span className="w-10 shrink-0" />
              <span className="min-w-0 flex-1 text-[10px] font-bold uppercase tracking-[.1em] text-[var(--muted)]">Vendor</span>
              {COLS.map((col) => {
                const on = activeCol === col.key;
                const align = "align" in col && col.align === "center" ? "justify-center" : "justify-end";
                return (
                  <span key={col.key} className={`${col.w} shrink-0 items-center gap-0.5 text-[10px] font-bold uppercase tracking-[.1em] ${col.key === "grade" ? "flex" : "hidden lg:flex"} ${on ? "text-[#2b31d8]" : "text-[var(--muted)]"} ${align}`}>
                    {col.label}{on && <ArrowDown className="size-3" />}
                  </span>
                );
              })}
              <span className="hidden w-4 shrink-0 sm:block" />
            </div>
            <div className="divide-y divide-[#111214]/10">
              {shown.map((entry, i) => <VendorRow key={entry.vendor.slug} entry={entry} rank={i + 1} activeCol={activeCol} />)}
            </div>
          </div>

          {/* What a dash means, said on the page. Over half this directory is upstream makers who
              sell nothing here, and a column of unexplained blanks reads as broken data rather
              than as the refusal to publish a letter the evidence can't support. */}
          {standIns.size > 0 && (
            <p className="mt-3 max-w-4xl text-[11px] font-medium leading-5 text-[var(--muted)]">
              <span className="font-bold uppercase tracking-[.1em] text-[#111214]/50">No grade?</span> A missing letter is never a mark against a vendor.{" "}
              {standIns.has("Not a shop") && <><span className="font-bold text-[#111214]">Not a shop</span> &mdash; an upstream maker we know from lab records; they sell nothing here, so the buyer scale doesn&rsquo;t apply. </>}
              {standIns.has("No listings") && <><span className="font-bold text-[#111214]">No listings</span> &mdash; a real storefront whose catalog we haven&rsquo;t captured, which is a fact about our coverage, not about them. </>}
              {standIns.has("Not rated") && <><span className="font-bold text-[#111214]">Not rated</span> &mdash; not enough independent evidence to publish a letter yet, which is different from finding something bad. </>}
              Unknown stays unknown here rather than being rounded into a score.
            </p>
          )}

          {ranked.length > visible && (
            <div className="mt-6 flex flex-col items-center gap-2">
              <button onClick={() => setVisible((v) => v + PAGE)} className="ink hard press rounded-full bg-white px-6 py-3 text-sm font-bold">Show {Math.min(PAGE, ranked.length - visible)} more</button>
              <p className="text-xs font-medium tabular-nums text-[var(--muted)]">Showing {shown.length} of {ranked.length}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

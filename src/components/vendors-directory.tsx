"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Factory, Filter, FlaskConical, Info, Search, ShieldAlert, ShieldCheck, Store, TrendingDown, TrendingUp, X } from "lucide-react";
import { VendorMark } from "@/components/vendor-mark";
import { DataOriginBadge } from "@/components/data-origin-badge";
import { VialGradePill } from "@/components/vial-grade-card";
import { PRIORITIES, rankVendors, type VendorDirectoryEntry } from "@/lib/vendor-ranking";
import { filterVendorEntries, hasActiveVendorFilters, offeredVendorKinds } from "@/lib/vendor-directory-filter";
import { vendorClaimLabelShort } from "@/lib/vendor-copy";

const PAGE = 18;


// One badge, tone from the composed verdict (red = avoid, amber = caution) so the directory and the
// vendor page always agree on how serious a vendor is. Label picks the most specific known reason.
function RedFlag({ entry }: { entry: VendorDirectoryEntry }) {
  if (entry.verdict !== "avoid" && entry.verdict !== "caution") return null;
  const label =
    entry.enforcement === "severe" ? "Enforcement action"
    : entry.defunct ? "Appears defunct"
    : entry.reviewSentiment === "scam" ? "Scam reports"
    : entry.reviewSentiment === "negative" ? "Negative reviews"
    : entry.integrityFlagged ? "COA integrity flag"
    : entry.enforcement === "caution" ? "Regulatory record"
    : entry.reviewSentiment === "mixed" ? "Mixed reviews"
    : entry.verdict === "avoid" ? "Flagged — see verify" : "Proceed with caution";
  const amber = entry.verdict === "caution";
  return <span className={`ink-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${amber ? "bg-[#fff4e0] text-[#b26a00]" : "bg-[#fff1f0] text-[#d3372c]"}`}><ShieldAlert className="size-3" /> {label}</span>;
}

// The metric the active priority is about — shown big on the card so the ranking is legible.
function Headline({ entry, priority }: { entry: VendorDirectoryEntry; priority: string }) {
  const v = entry.vendor;
  if (priority === "price") {
    const idx = entry.priceIndex;
    if (idx == null) return <Muted>No comparable prices</Muted>;
    const good = idx <= 0;
    return <Big value={`${idx > 0 ? "+" : ""}${idx}%`} label="typical price vs market" accent={idx === 0 ? undefined : good ? "#0e8f80" : "#d3372c"} icon={idx > 0 ? TrendingUp : TrendingDown} />;
  }
  if (priority === "purity") return v.medianPurity != null ? <Big value={`${v.medianPurity.toFixed(1)}%`} label="median tested purity" accent="#0e8f80" icon={FlaskConical} /> : <Muted>No purity on record</Muted>;
  if (priority === "tested") return v.coaCount > 0 ? <Big value={String(v.coaCount)} label={`independent lab test${v.coaCount === 1 ? "" : "s"}`} icon={FlaskConical} /> : <Muted>No independent tests yet</Muted>;
  if (priority === "reputation") {
    const s = entry.reviewSentiment;
    if (!s || s === "unknown") return <Muted>No buyer reputation yet</Muted>;
    const good = s === "positive";
    return <Big value={s[0].toUpperCase() + s.slice(1)} label={`buyer sentiment${v.reviewCount ? ` · ${v.reviewCount} on file` : ""}`} accent={good ? "#0e8f80" : s === "mixed" ? "#b26a00" : "#d3372c"} icon={good ? ShieldCheck : ShieldAlert} />;
  }
  // reliable → ONE quiet line carrying the two signals the stat strip below does NOT already show
  // (flags + reviews). The old chip row repeated the strip's numbers ("18 independent tests" above
  // "18 TESTS") — four pills saying the same thing the card said an inch lower.
  const s = entry.reviewSentiment;
  const rep = !s || s === "unknown" ? { t: "No buyer reviews yet", c: "text-[var(--muted)]" }
    : s === "positive" ? { t: "Positive buyer reviews", c: "text-[#0e8f80]" }
    : s === "mixed" ? { t: "Mixed buyer reviews", c: "text-[#b26a00]" }
    : { t: s === "scam" ? "Scam reports on file" : "Negative buyer reviews", c: "text-[#d3372c]" };
  const clean = entry.verdict !== "avoid" && entry.verdict !== "caution";
  return (
    <div className="ink-1 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[12px] bg-[var(--background)] px-3 py-2.5 text-[12px] font-bold">
      <span className={`inline-flex items-center gap-1.5 ${clean ? "text-[#0e8f80]" : entry.verdict === "caution" ? "text-[#b26a00]" : "text-[#d3372c]"}`}>
        {clean ? <ShieldCheck className="size-3.5" /> : <ShieldAlert className="size-3.5" />}
        {clean ? "No flags on record" : entry.verdict === "caution" ? "Caution — see page" : "Flagged — see page"}
      </span>
      <span className={rep.c}>{rep.t}</span>
    </div>
  );
}

function Big({ value, label, accent, icon: Icon }: { value: string; label: string; accent?: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }) {
  return (
    <div className="ink-1 flex items-center gap-3 rounded-[12px] bg-[var(--background)] p-3">
      <Icon className="size-5 shrink-0" style={{ color: accent ?? "#39414e" }} />
      <div>
        <p className="text-xl font-extrabold tabular-nums leading-none tracking-[-.03em]" style={accent ? { color: accent } : undefined}>{value}</p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[.08em] text-[var(--muted)]">{label}</p>
      </div>
    </div>
  );
}
function Muted({ children }: { children: React.ReactNode }) { return <p className="ink-1 rounded-[12px] bg-[var(--background)] p-3 text-xs font-semibold text-[var(--muted)]">{children}</p>; }

function VendorRankCard({ entry, priority, rank }: { entry: VendorDirectoryEntry; priority: string; rank: number }) {
  const v = entry.vendor;
  return (
    <Link href={`/vendors/${v.slug}`} className="ink-1 hard-sm press group flex flex-col rounded-[16px] bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="ink-1 grid size-8 shrink-0 place-items-center rounded-full bg-[var(--background)] text-xs font-extrabold tabular-nums text-[var(--muted)]">{rank}</span>
        <VendorMark initials={v.initials} accent={v.accent} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-base font-extrabold tracking-[-.02em]">{v.name}</h3>
            {v.origin === "live" && <DataOriginBadge origin="live" compact />}
            {v.kind === "manufacturer" && <span className="inline-flex items-center gap-1 rounded-full bg-[#39414e] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.06em] text-white"><Factory className="size-2.5" /> Maker</span>}
            <RedFlag entry={entry} />
            {/* This page's headline question is literally "which one won't scam me?" — withholding
                the grade it has already computed made the reader reconcile a rank against a grade
                they could not see. */}
            {v.grade && <VialGradePill grade={v.grade} />}
          </div>
          <p className="mt-0.5 truncate text-[11px] font-semibold text-[var(--muted)]">{vendorClaimLabelShort(v.profileStatus)}{v.location ? ` · ${v.location}` : ""}</p>
        </div>
        <ArrowUpRight className="size-4 shrink-0 text-[#111214] transition group-hover:translate-x-0.5" />
      </div>
      <div className="mt-3"><Headline entry={entry} priority={priority} /></div>
      <div className="ink-1 mt-2.5 grid grid-cols-3 gap-2 rounded-[12px] bg-[var(--background)] p-2.5 text-center">
        <Mini value={String(v.coaCount)} label="Tests" />
        <Mini value={v.medianPurity != null ? `${v.medianPurity.toFixed(1)}%` : "—"} label="Purity" />
        <Mini value={v.kind === "storefront" ? String(v.productCount) : String(v.passportCount)} label={v.kind === "storefront" ? "Listings" : "Passports"} />
      </div>
    </Link>
  );
}
function Mini({ value, label }: { value: string; label: string }) { return <div><p className="text-sm font-extrabold tabular-nums leading-none">{value}</p><p className="mt-1 text-[9px] font-semibold uppercase tracking-[.06em] text-[var(--muted)]">{label}</p></div>; }

export function VendorsDirectory({ entries }: { entries: VendorDirectoryEntry[] }) {
  const [priority, setPriority] = useState("reliable");
  const [kind, setKind] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE);
  const active = PRIORITIES.find((p) => p.key === priority)!;

  const filters = useMemo(() => ({ query, kind }), [query, kind]);
  const ranked = useMemo(() => rankVendors(filterVendorEntries(entries, filters), priority), [entries, filters, priority]);

  // Counts are taken over the WHOLE directory, not the current results, so a chip's number never
  // shifts under the pointer. `offeredVendorKinds` drops any kind that matches nothing (a dead
  // control that empties the grid and reads as "we lost your vendors") and any kind that matches
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

  function reset() {
    setQuery("");
    setKind("all");
    setVisible(PAGE);
  }

  return (
    <div>
      {/* Priority selector */}
      <div className="ink hard-sm rounded-[16px] bg-white p-4 sm:p-5">
        <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#5a4be0]">What matters most to you?</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRIORITIES.map((p) => (
            <button key={p.key} type="button" onClick={() => applyPriority(p.key)} aria-pressed={priority === p.key}
              className={`ink-1 press rounded-full px-3.5 py-2 text-[13px] font-bold transition ${priority === p.key ? "bg-[#111214] text-white" : "bg-white text-[#111214]"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]"><span className="font-extrabold tracking-[-.01em] text-[#111214]">&ldquo;{active.question}&rdquo;</span> {active.blurb}</p>
      </div>

      {/* Newcomer guidance (shown on the default/reliable lens) */}
      {priority === "reliable" && (
        <div className="ink-1 mt-3 rounded-[14px] bg-[#eef0ff] p-3.5">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.12em] text-[#2b31d8]"><Info className="size-3.5" /> New to this? Three rules</p>
          <ul className="mt-2 grid gap-x-6 gap-y-1.5 text-[12px] font-medium leading-5 text-[#111214]/75 sm:grid-cols-3">
            <li>A real vendor shows a batch-matched third-party certificate &mdash; never just their own claim.</li>
            <li>A price far below everyone else is a warning, not a deal.</li>
            <li>Everything here is sold research-use-only &mdash; no pharmacist or clinician stands behind it.</li>
          </ul>
        </div>
      )}

      {/* Keyword search. A buyer who arrives knowing the name — from a forum, a friend, a receipt —
          was previously made to page through the directory 18 at a time to answer "is this the one
          that scams people?", which is the question this page is headlined with. */}
      <div className="mt-5 flex items-center gap-3 rounded-[14px] border-[1.5px] border-[#111214] bg-white px-4 py-3 focus-within:shadow-[3px_3px_0_#111214]">
        <Search className="size-4 shrink-0 text-[var(--muted)]" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => applyQuery(event.target.value)}
          placeholder="Search a vendor by name or where it ships from"
          aria-label="Search vendors"
          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:font-normal placeholder:text-[var(--muted)]"
        />
        {query && (
          <button type="button" onClick={() => applyQuery("")} aria-label="Clear search" className="ink-1 rounded-full bg-white p-1.5 text-[var(--muted)] transition hover:text-[#111214]">
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <p className="mt-2 text-[11px] font-medium text-[var(--muted)]">
        Names match with or without spacing &mdash; &ldquo;swisschems&rdquo; finds Swiss Chems. Search reads the name, URL, and location, never marketing copy.
      </p>

      {/* Kind filter + count */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
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
        <div className="flex flex-wrap items-center gap-3">
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
      </div>

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
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((entry, i) => <VendorRankCard key={entry.vendor.slug} entry={entry} priority={priority} rank={i + 1} />)}
          </div>
          {ranked.length > visible && (
            <div className="mt-8 flex flex-col items-center gap-2">
              <button onClick={() => setVisible((v) => v + PAGE)} className="ink hard press rounded-full bg-white px-6 py-3 text-sm font-bold">Show {Math.min(PAGE, ranked.length - visible)} more</button>
              <p className="text-xs font-medium tabular-nums text-[var(--muted)]">Showing {shown.length} of {ranked.length}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

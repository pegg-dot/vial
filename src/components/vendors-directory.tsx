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
  // reliable → the signals it rests on, as chips
  return (
    <div className="flex flex-wrap gap-1.5">
      <Chip ok={v.coaCount > 0}>{v.coaCount > 0 ? `${v.coaCount} independent test${v.coaCount === 1 ? "" : "s"}` : "No independent tests"}</Chip>
      {v.medianPurity != null && <Chip ok>{v.medianPurity.toFixed(1)}% pure</Chip>}
      {entry.reviewSentiment && entry.reviewSentiment !== "unknown" && <Chip ok={entry.reviewSentiment === "positive"}>{entry.reviewSentiment} reviews</Chip>}
      <Chip tone={entry.verdict === "avoid" ? "bad" : entry.verdict === "caution" ? "caution" : "good"}>{entry.verdict === "avoid" ? "flagged" : entry.verdict === "caution" ? "caution" : "no flags on record"}</Chip>
    </div>
  );
}

function Big({ value, label, accent, icon: Icon }: { value: string; label: string; accent?: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }) {
  return (
    <div className="ink-1 flex items-center gap-3 rounded-[14px] bg-[var(--background)] p-3">
      <Icon className="size-5 shrink-0" style={{ color: accent ?? "#39414e" }} />
      <div>
        <p className="text-xl font-extrabold tabular-nums leading-none tracking-[-.03em]" style={accent ? { color: accent } : undefined}>{value}</p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[.08em] text-[var(--muted)]">{label}</p>
      </div>
    </div>
  );
}
function Muted({ children }: { children: React.ReactNode }) { return <p className="ink-1 rounded-[14px] bg-[var(--background)] p-3 text-xs font-semibold text-[var(--muted)]">{children}</p>; }
function Chip({ ok, tone, children }: { ok?: boolean; tone?: "good" | "caution" | "bad"; children: React.ReactNode }) {
  const t = tone ?? (ok ? "good" : "caution");
  const cls = t === "good" ? "bg-[#e6fbf4] text-[#0e8f80]" : t === "bad" ? "bg-[#fff1f0] text-[#d3372c]" : "bg-[#fff4e0] text-[#b26a00]";
  return <span className={`ink-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${cls}`}>{children}</span>;
}

function VendorRankCard({ entry, priority, rank }: { entry: VendorDirectoryEntry; priority: string; rank: number }) {
  const v = entry.vendor;
  return (
    <Link href={`/vendors/${v.slug}`} className="ink-1 hard press group flex flex-col rounded-[20px] bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="ink-1 grid size-8 shrink-0 place-items-center rounded-full bg-[var(--background)] text-xs font-extrabold tabular-nums text-[var(--muted)]">{rank}</span>
        <VendorMark initials={v.initials} accent={v.accent} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-base font-extrabold tracking-[-.02em]">{v.name}</h3>
            {v.origin === "live" && <DataOriginBadge origin="live" />}
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
      <div className="mt-4"><Headline entry={entry} priority={priority} /></div>
      <div className="ink-1 mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-[var(--background)] p-2.5 text-center">
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
      <div className="ink hard rounded-[20px] bg-white p-5 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#39414e]">What matters most to you?</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {PRIORITIES.map((p) => (
            <button key={p.key} type="button" onClick={() => applyPriority(p.key)} aria-pressed={priority === p.key}
              className={`ink-1 press rounded-full px-4 py-2.5 text-sm font-bold transition ${priority === p.key ? "bg-[#111214] text-white" : "bg-white text-[#111214]"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <p className="mt-4 text-lg font-extrabold tracking-[-.02em]">&ldquo;{active.question}&rdquo;</p>
        <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">{active.blurb}</p>
      </div>

      {/* Newcomer guidance (shown on the default/reliable lens) */}
      {priority === "reliable" && (
        <div className="ink-1 mt-4 flex items-start gap-3 rounded-[16px] bg-[#eef0ff] p-4">
          <Info className="mt-0.5 size-4 shrink-0 text-[#2b31d8]" />
          <p className="text-[13px] font-medium leading-6 text-[#111214]">
            <span className="font-extrabold">New to this?</span> Three rules: a vendor should show a batch-matched third-party lab certificate (not their own claim); a price far below everyone else is a warning, not a deal; and these are sold research-use-only &mdash; no pharmacist or clinician stands behind them. Rankings use verifiable facts only, never who a product is &ldquo;for.&rdquo;
          </p>
        </div>
      )}

      {/* Keyword search. A buyer who arrives knowing the name — from a forum, a friend, a receipt —
          was previously made to page through the directory 18 at a time to answer "is this the one
          that scams people?", which is the question this page is headlined with. */}
      <div className="mt-6 flex items-center gap-3 rounded-[14px] border-[1.5px] border-[#111214] bg-white px-4 py-3 focus-within:shadow-[3px_3px_0_#39414e]">
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
        Names match with or without their spacing &mdash; &ldquo;swisschems&rdquo; finds Swiss Chems. Search does not read vendor marketing copy, only the name, the URL, and the stated location.
      </p>

      {/* Kind filter + count */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {/* "Everyone" always renders — it is the only way back to the unfiltered directory. */}
          <button type="button" onClick={() => applyKind("all")} aria-pressed={kind === "all"}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${kind === "all" ? "ink-1 bg-[#39414e] text-white" : "text-[var(--muted)] hover:text-[#111214]"}`}>
            Everyone
          </button>
          {kindOptions.map((option) => (
            <button key={option.id} type="button" onClick={() => applyKind(option.id)} aria-pressed={kind === option.id} title={option.note}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${kind === option.id ? "ink-1 bg-[#39414e] text-white" : "text-[var(--muted)] hover:text-[#111214]"}`}>
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
        <div className="ink hard mt-5 rounded-[20px] bg-white px-6 py-16 text-center">
          <p className="text-lg font-extrabold">No vendor on record matches that.</p>
          <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-[var(--muted)]">
            We only list sellers we hold a record for, so the directory is deliberately narrower than the market. Finding nothing here is a fact about our coverage, not a verdict on the vendor.
          </p>
          <button type="button" onClick={reset} className="ink hard-sm press mt-6 rounded-full bg-[#111214] px-5 py-2.5 text-sm font-bold text-white">Clear filters</button>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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

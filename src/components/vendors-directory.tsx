"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Factory, FlaskConical, Info, ShieldAlert, ShieldCheck, Store, TrendingDown, TrendingUp } from "lucide-react";
import { VendorMark } from "@/components/vendor-mark";
import { DataOriginBadge } from "@/components/data-origin-badge";
import { PRIORITIES, rankVendors, type VendorDirectoryEntry } from "@/lib/vendor-ranking";
import { vendorStatusLabel } from "@/lib/format";

const PAGE = 18;
const KINDS = [
  { key: "all", label: "Everyone" },
  { key: "storefront", label: "Shops you can buy from" },
  { key: "manufacturer", label: "Upstream makers" },
] as const;

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
          </div>
          <p className="mt-0.5 truncate text-[11px] font-semibold text-[var(--muted)]">{vendorStatusLabel(v.profileStatus)}{v.location ? ` · ${v.location}` : ""}</p>
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
  const [visible, setVisible] = useState(PAGE);
  const active = PRIORITIES.find((p) => p.key === priority)!;

  const ranked = useMemo(() => {
    const filtered = entries.filter((e) => kind === "all" || e.vendor.kind === kind);
    return rankVendors(filtered, priority);
  }, [entries, kind, priority]);

  const shown = ranked.slice(0, visible);

  return (
    <div>
      {/* Priority selector */}
      <div className="ink hard rounded-[20px] bg-white p-5 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#39414e]">What matters most to you?</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {PRIORITIES.map((p) => (
            <button key={p.key} type="button" onClick={() => { setPriority(p.key); setVisible(PAGE); }} aria-pressed={priority === p.key}
              className={`ink-1 press rounded-full px-4 py-2.5 text-sm font-bold transition ${priority === p.key ? "bg-[#111214] text-white" : "bg-white text-[#111214]"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <p className="mt-4 text-lg font-extrabold tracking-[-.02em]">“{active.question}”</p>
        <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">{active.blurb}</p>
      </div>

      {/* Newcomer guidance (shown on the default/reliable lens) */}
      {priority === "reliable" && (
        <div className="ink-1 mt-4 flex items-start gap-3 rounded-[16px] bg-[#eef0ff] p-4">
          <Info className="mt-0.5 size-4 shrink-0 text-[#2b31d8]" />
          <p className="text-[13px] font-medium leading-6 text-[#111214]">
            <span className="font-extrabold">New to this?</span> Three rules: a vendor should show a batch-matched third-party lab certificate (not their own claim); a price far below everyone else is a warning, not a deal; and these are sold research-use-only — no pharmacist or clinician stands behind them. Rankings use verifiable facts only, never who a product is “for.”
          </p>
        </div>
      )}

      {/* Kind filter + count */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button key={k.key} type="button" onClick={() => { setKind(k.key); setVisible(PAGE); }} aria-pressed={kind === k.key}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${kind === k.key ? "ink-1 bg-[#39414e] text-white" : "text-[var(--muted)] hover:text-[#111214]"}`}>
              {k.key === "storefront" ? <Store className="size-3.5" /> : k.key === "manufacturer" ? <Factory className="size-3.5" /> : null}{k.label}
            </button>
          ))}
        </div>
        <p className="text-sm font-medium text-[var(--muted)]"><span className="font-extrabold text-black">{ranked.length}</span> vendors</p>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((entry, i) => <VendorRankCard key={entry.vendor.slug} entry={entry} priority={priority} rank={i + 1} />)}
      </div>
      {ranked.length > visible && (
        <div className="mt-8 flex justify-center">
          <button onClick={() => setVisible((v) => v + PAGE)} className="ink hard press rounded-full bg-white px-6 py-3 text-sm font-bold">Show {Math.min(PAGE, ranked.length - visible)} more</button>
        </div>
      )}
    </div>
  );
}

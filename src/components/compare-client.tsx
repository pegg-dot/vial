"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Crown, Info, X } from "lucide-react";
import { useMarketplace } from "./marketplace-state";
import { ProductPhoto } from "./product-photo";
import { formatCurrency } from "@/lib/format";
import { COMPARE_DIMS, GROUP_LABEL, differingKeys, type CompareEntry, type CompareCell, type DimGroup } from "@/lib/compare-model";

const PRIORITIES = [
  { key: "all", label: "Overview" },
  { key: "value", label: "Best value", dim: "realPerMg", lower: true, group: "hidden" as DimGroup },
  { key: "purity", label: "Purest", dim: "purity", lower: false, group: "quality" as DimGroup },
  { key: "trust", label: "Most trusted", dim: "verdict", lower: false, group: "reliability" as DimGroup },
];
const GROUP_ORDER: DimGroup[] = ["price", "quality", "reliability", "hidden"];
const TONE_BG: Record<string, string> = { good: "bg-[#e6fbf4]", warn: "bg-[#fff4e0]", bad: "bg-[#fff1f0]", neutral: "" };
const TONE_TX: Record<string, string> = { good: "text-[#0e8f80]", warn: "text-[#b26a00]", bad: "text-[#d3372c]", neutral: "text-[#111214]" };

export function CompareClient() {
  const { catalog, compare, toggleCompare } = useMarketplace();
  const [entries, setEntries] = useState<CompareEntry[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [priority, setPriority] = useState("all");
  const [diffOnly, setDiffOnly] = useState(false);

  // When nothing is picked, show a real example: the 3 most-tested live listings.
  const exampleSlugs = useMemo(() => catalog.products.filter((p) => p.origin === "live").slice(0, 3).map((p) => p.slug), [catalog.products]);
  const isExample = compare.length === 0;
  const slugs = compare.length ? compare.slice(0, 4) : exampleSlugs;
  const key = slugs.join(",");

  // Derive loading from whether the current entries correspond to the requested slugs,
  // so the effect never sets state synchronously in its body.
  useEffect(() => {
    let live = true;
    fetch("/api/v1/compare", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slugs }) })
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((d) => { if (live) { setEntries(d.entries ?? []); setLoadedKey(key); } })
      .catch(() => { if (live) { setEntries([]); setLoadedKey(key); } });
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const loading = loadedKey !== key;

  const ordered = useMemo(() => {
    const p = PRIORITIES.find((x) => x.key === priority);
    if (!p || !p.dim) return entries;
    return [...entries].sort((a, b) => {
      const av = a.cells[p.dim!]?.num ?? (p.lower ? Infinity : -Infinity);
      const bv = b.cells[p.dim!]?.num ?? (p.lower ? Infinity : -Infinity);
      return p.lower ? av - bv : bv - av;
    });
  }, [entries, priority]);

  const diff = useMemo(() => differingKeys(entries), [entries]);
  const verdicts = useMemo(() => summarize(entries), [entries]);
  const activeGroup = PRIORITIES.find((x) => x.key === priority)?.group;

  if (loading) return <div className="ink hard rounded-[20px] bg-white p-10 text-center text-sm font-semibold text-[var(--muted)]">Building the comparison…</div>;
  if (entries.length === 0) return (
    <div className="ink rounded-[20px] bg-white px-6 py-16 text-center">
      <p className="text-xl font-extrabold tracking-[-.03em]">Nothing to compare yet</p>
      <p className="mt-2 text-sm font-medium text-[var(--muted)]">Add listings from the market with the compare button, then come back here.</p>
      <Link href="/market" className="ink hard press mt-6 inline-flex rounded-full bg-[#111214] px-5 py-3 text-sm font-bold text-white">Browse the market</Link>
    </div>
  );

  const cols = `200px repeat(${ordered.length}, minmax(210px, 1fr))`;

  return (
    <div>
      {isExample && <div className="ink-1 mb-5 rounded-[14px] bg-[#f0edff] px-4 py-3 text-sm font-semibold text-[#6d5dfc]">Showing an example. Add listings from the market to build your own comparison.</div>}

      {/* Bottom line first — the comparison decides, it doesn't just list. */}
      {entries.length > 1 && (
        <div className="ink hard mb-5 grid gap-3 rounded-[18px] bg-white p-5 sm:grid-cols-4">
          <Verdict label="Cheapest sticker" name={verdicts.cheapest} tint="text-[#2b31d8]" />
          <Verdict label="Best cost / mg" name={verdicts.value} tint="text-[#0e8f80]" />
          <Verdict label="Highest purity" name={verdicts.purest} tint="text-[#0e8f80]" />
          <Verdict label="Most trusted vendor" name={verdicts.trusted} tint="text-[#2b31d8]" />
        </div>
      )}

      {/* Controls */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="ink-1 inline-flex flex-wrap gap-1 rounded-full bg-white p-1">
          {PRIORITIES.map((p) => (
            <button key={p.key} type="button" onClick={() => setPriority(p.key)} aria-pressed={priority === p.key}
              className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${priority === p.key ? "bg-[#111214] text-white" : "text-[var(--muted)] hover:text-[#111214]"}`}>{p.label}</button>
          ))}
        </div>
        <button type="button" onClick={() => setDiffOnly((v) => !v)} aria-pressed={diffOnly}
          className={`ink-1 inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold transition ${diffOnly ? "bg-[#111214] text-white" : "bg-white text-[#111214]"}`}>
          {diffOnly ? "Showing differences" : "Show differences only"}
        </button>
      </div>

      <div className="overflow-x-auto pb-3">
        <div className="ink hard grid gap-px overflow-hidden rounded-[20px] bg-[#111214]" style={{ gridTemplateColumns: cols, minWidth: 200 + ordered.length * 210 }}>
          {/* Header: product columns */}
          <div className="sticky left-0 z-10 bg-[#f7f7f4] p-4" />
          {ordered.map((e) => (
            <div key={e.slug} className="relative bg-white p-4">
              {!isExample && <button onClick={() => toggleCompare(e.slug)} aria-label={`Remove ${e.name}`} className="ink-1 absolute right-3 top-3 z-10 grid size-7 place-items-center rounded-full bg-white press"><X className="size-3.5" /></button>}
              <div className="ink-1 overflow-hidden rounded-[14px]"><ProductPhoto name={e.name} quantity={e.quantity} accent={["#12b3a6", "#8fffd6", "#fff"]} imageUrl={e.imageUrl} compact decorative /></div>
              <Link href={`/products/${e.slug}`} className="mt-3 block text-[15px] font-extrabold leading-tight tracking-[-.02em] hover:underline">{e.name} <span className="text-black/45">{e.quantity}</span></Link>
              <Link href={`/vendors/${e.vendorSlug}`} className="mt-0.5 block truncate text-xs font-semibold text-[var(--muted)] hover:text-black">{e.vendorName}</Link>
              <p className="mt-2 text-xl font-extrabold tabular-nums tracking-[-.03em]">{formatCurrency(e.price)}</p>
            </div>
          ))}

          {/* Grouped dimension rows */}
          {GROUP_ORDER.map((group) => {
            const dims = COMPARE_DIMS.filter((d) => d.group === group && (!diffOnly || diff.has(d.key)));
            if (dims.length === 0) return null;
            const emphasize = activeGroup === group;
            return (
              <div key={group} className="contents">
                <div className="sticky left-0 z-10 col-span-full flex items-center gap-2 bg-[#111214] px-4 py-2.5 text-[11px] font-bold uppercase tracking-[.14em] text-white/90">
                  {GROUP_LABEL[group]}{group === "hidden" && <span className="rounded-full bg-[#8fffd6] px-2 py-0.5 text-[9px] font-extrabold text-[#111214]">the edge</span>}{emphasize && <span className="text-[#8fffd6]">◂ your priority</span>}
                </div>
                {dims.map((dim) => (
                  <div key={dim.key} className="contents">
                    <div className="sticky left-0 z-10 flex items-start gap-1.5 bg-[#f7f7f4] p-4 text-[13px] font-extrabold text-[#111214]">
                      <span>{dim.label}</span>
                      {dim.hint && <span className="group/h relative mt-0.5"><Info className="size-3 text-black/30" /><span className="pointer-events-none absolute left-5 top-0 z-20 hidden w-52 rounded-lg bg-[#111214] px-3 py-2 text-[11px] font-medium leading-4 text-white group-hover/h:block">{dim.hint}</span></span>}
                    </div>
                    {ordered.map((e) => <Cell key={`${dim.key}-${e.slug}`} cell={e.cells[dim.key]} emphasize={emphasize} />)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link href="/market" className="ink hard-sm press rounded-full bg-[#111214] px-5 py-3 text-sm font-bold text-white">Add from market</Link>
        <p className="text-sm font-medium text-[var(--muted)]">Green = best in this set · a base-rate delta (e.g. −14%) shows how it compares to the market.</p>
      </div>
    </div>
  );
}

function Cell({ cell, emphasize }: { cell?: CompareCell; emphasize?: boolean }) {
  if (!cell) return <div className="bg-white p-4 text-sm text-[var(--muted)]">—</div>;
  // Relative winner-marking wins over absolute tone so a "worst-in-set" cell never renders on a
  // reassuring green tone. best → teal, worst → plain/muted, otherwise the absolute tone tint.
  const bg = cell.best ? "bg-[#e6fbf4]" : cell.worst ? "bg-white" : cell.tone ? TONE_BG[cell.tone] || "bg-white" : "bg-white";
  const tx = cell.best ? "text-[#0e8f80]" : cell.worst ? "text-[var(--muted)]" : cell.tone ? TONE_TX[cell.tone] : "text-[#111214]";
  return (
    <div className={`relative flex flex-col justify-center gap-1 p-4 text-sm ${bg} ${emphasize ? "ring-1 ring-inset ring-[#12b3a6]/30" : ""}`}>
      <div className="flex items-center gap-1.5">
        {cell.best && <Crown className="size-3.5 shrink-0 text-[#0e8f80]" />}
        <span className={`font-extrabold tabular-nums ${tx}`}>{cell.text}</span>
      </div>
      {cell.baselinePct != null && cell.baselinePct !== 0 && (
        <span className={`text-[11px] font-bold tabular-nums ${cell.baselinePct <= 0 ? "text-[#0e8f80]" : "text-[#d3372c]"}`}>{cell.baselinePct > 0 ? "+" : ""}{cell.baselinePct}% vs market</span>
      )}
    </div>
  );
}

function Verdict({ label, name, tint }: { label: string; name: string | null; tint: string }) {
  return (
    <div className="ink-1 rounded-[14px] bg-[var(--background)] p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-[.1em] text-[var(--muted)]">{label}</p>
      <p className={`mt-1 truncate text-sm font-extrabold ${name ? tint : "text-[var(--muted)]"}`}>{name ?? "—"}</p>
    </div>
  );
}

// Bottom-line winners from the marked cells. Cheapest uses sticker price (always present);
// $/mg only resolves when at least two listings state a size.
function summarize(entries: CompareEntry[]): { cheapest: string | null; value: string | null; purest: string | null; trusted: string | null } {
  const winner = (key: string) => { const e = entries.find((x) => x.cells[key]?.best); return e ? `${e.name} · ${e.vendorName}` : null; };
  return { cheapest: winner("price"), value: winner("perMg"), purest: winner("purity"), trusted: winner("verdict") };
}

"use client";
import { useMemo, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { Compound, Product } from "@/lib/types";
import { shelfForCompound } from "@/lib/market-taxonomy";
import { compoundPriceRange, compoundTrustTier, trending } from "@/lib/curation";
import { formatCurrency } from "@/lib/format";
import { PriceSeries } from "@/components/price-series";
import { describeCompoundBasis, formatPct } from "@/lib/price-trend";
import { DataOriginBadge } from "@/components/data-origin-badge";
import { TrustTierChip } from "./trust-tier-chip";

type SortKey = "trending" | "price" | "purity" | "tests" | "change";

// Fifteen rows first. The table rendered every compound at once — sixty rows before the stacks
// below it were reachable. More on request, and the page resets whenever the list or sort changes
// so "show more" never carries over onto a different list.
const PAGE = 15;

function HeaderCell({ label, sortKey, active, onSort, className = "" }: { label: string; sortKey?: SortKey; active: boolean; onSort: (k: SortKey) => void; className?: string }) {
  return (
    <th className={`px-4 py-3 font-bold ${className}`}>
      {sortKey ? (
        <button type="button" onClick={() => onSort(sortKey)} className={`inline-flex items-center gap-1 uppercase tracking-[.1em] ${active ? "text-[#111214]" : "text-[var(--muted)] hover:text-[#111214]"}`}>
          {label}{active && <span aria-hidden>▾</span>}
        </button>
      ) : (
        <span className="uppercase tracking-[.1em] text-[var(--muted)]">{label}</span>
      )}
    </th>
  );
}

// The terminal view: a dense, sortable ranked market table (CoinMarketCap pattern) —
// VialGrade's Bloomberg-terminal expression. Scrolls horizontally rather than dropping evidence.
export function CompoundMarketTable({ compounds, products, onOpen }: { compounds: Compound[]; products: Product[]; onOpen: (items: Compound[], index: number) => void }) {
  const [sort, setSort] = useState<SortKey>("trending");
  // Pagination is remembered against the exact list + sort it was requested for; any other pair
  // starts back at PAGE without an effect having to notice the change.
  const [page, setPage] = useState<{ of: Compound[]; sort: SortKey; visible: number } | null>(null);
  const visible = page && page.of === compounds && page.sort === sort ? page.visible : PAGE;

  // The trail is the cheapest listing's dated change points per compound (the one a buyer would pick).
  const pointsBySlug = useMemo(() => {
    const cheapest = new Map<string, Product>();
    for (const p of products) {
      if (!p.pricePoints?.length) continue;
      const held = cheapest.get(p.compoundSlug);
      if (!held || p.price < held.price) cheapest.set(p.compoundSlug, p);
    }
    const map = new Map<string, { name: string; points: Product["pricePoints"] }>();
    for (const [slug, p] of cheapest) map.set(slug, { name: p.name, points: p.pricePoints });
    return map;
  }, [products]);

  const rangeBySlug = useMemo(() => {
    const map = new Map<string, { from: number | null; count: number }>();
    for (const c of compounds) map.set(c.slug, compoundPriceRange(c.slug, products));
    return map;
  }, [compounds, products]);

  const rows = useMemo(() => {
    if (sort === "trending") return trending(compounds, compounds.length);
    const arr = [...compounds];
    switch (sort) {
      case "price": arr.sort((a, b) => (rangeBySlug.get(a.slug)?.from ?? Infinity) - (rangeBySlug.get(b.slug)?.from ?? Infinity)); break;
      case "purity": arr.sort((a, b) => (b.medianPurity ?? -1) - (a.medianPurity ?? -1)); break;
      case "tests": arr.sort((a, b) => b.coaCount - a.coaCount); break;
      case "change": arr.sort((a, b) => Math.abs(b.priceChange ?? 0) - Math.abs(a.priceChange ?? 0)); break;
    }
    return arr;
  }, [compounds, sort, rangeBySlug]);
  const shown = rows.slice(0, visible);
  const hidden = rows.length - shown.length;

  return (
    <div>
    <div className="ink hard overflow-x-auto rounded-[18px] bg-white">
      <table className="w-full min-w-[940px] text-left text-sm">
        <thead className="border-b-2 border-[#111214] bg-[#f7f7f4] text-[10px]">
          <tr>
            <HeaderCell label="#" active={false} onSort={setSort} />
            <HeaderCell label="Compound" sortKey="trending" active={sort === "trending"} onSort={setSort} />
            <HeaderCell label="Listings" active={false} onSort={setSort} />
            <HeaderCell label="From" sortKey="price" active={sort === "price"} onSort={setSort} />
            <HeaderCell label="Median" active={false} onSort={setSort} />
            <HeaderCell label="Δ" sortKey="change" active={sort === "change"} onSort={setSort} />
            <HeaderCell label="Purity" sortKey="purity" active={sort === "purity"} onSort={setSort} />
            <HeaderCell label="Tests" sortKey="tests" active={sort === "tests"} onSort={setSort} />
            <HeaderCell label="Verification" active={false} onSort={setSort} />
            <HeaderCell label="Trail" active={false} onSort={setSort} />
          </tr>
        </thead>
        <tbody className="divide-y divide-[#111214]/10">
          {shown.map((c, i) => {
            const range = rangeBySlug.get(c.slug) ?? { from: null, count: 0 };
            const basis = c.priceChangeBasis;
            const earned = basis?.medianPct != null;
            const delta = earned ? (basis!.medianPct as number) : 0;
            const trail = pointsBySlug.get(c.slug);
            const basisCopy = describeCompoundBasis(basis);
            return (
              <tr
                key={c.slug}
                onClick={() => onOpen(shown, i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(shown, i); }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Quick view ${c.name}`}
                className="cursor-pointer transition hover:bg-[#f7f7f4] focus:bg-[#f7f7f4] focus:outline-2 focus:outline-offset-[-2px] focus:outline-[#2b31d8]"
              >
                <td className="px-4 py-3 font-extrabold tabular-nums text-[var(--muted)]">{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold tracking-[-.02em]">{c.name}</span>
                    {c.origin === "live" && <DataOriginBadge origin="live" />}
                  </div>
                  <span className="text-[11px] font-semibold text-[var(--muted)]">{shelfForCompound(c).label}</span>
                </td>
                <td className="px-4 py-3 font-bold tabular-nums">{c.listings}</td>
                <td className="px-4 py-3 font-extrabold tabular-nums">{range.from != null ? formatCurrency(range.from) : "—"}</td>
                <td className="px-4 py-3 font-bold tabular-nums text-[var(--muted)]">{c.medianPrice > 0 ? formatCurrency(c.medianPrice) : "—"}</td>
                <td className="px-4 py-3">
                  {/* Earned or absent (spec D6). Direction is the arrow; colour stays ink — a
                      rising price is not "good" and a falling one is not "bad" here. */}
                  <span className={`inline-flex items-center gap-0.5 font-bold tabular-nums ${earned ? "text-[#111214]" : "text-[var(--muted)]"}`} title={basisCopy}>
                    {earned && delta > 0 ? <TrendingUp className="size-3" /> : earned && delta < 0 ? <TrendingDown className="size-3" /> : null}
                    {earned ? formatPct(delta) : "—"}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums">{c.medianPurity != null ? `${c.medianPurity.toFixed(1)}%` : <span className="text-[var(--muted)]">—</span>}</td>
                <td className="px-4 py-3 font-bold tabular-nums">{c.coaCount || <span className="font-normal text-[var(--muted)]">—</span>}</td>
                <td className="px-4 py-3"><TrustTierChip tier={compoundTrustTier(c)} /></td>
                <td className="px-4 py-3"><div className="h-8 w-20">{trail ? <PriceSeries points={trail.points} description={`${trail.name}: observed prices. ${basisCopy}`} accent="#111214" height={32} uid={c.slug} compact /> : <span className="text-[11px] text-[var(--muted)]">no checks yet</span>}</div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    <div className="mt-4 flex items-center justify-center gap-4">
      <p className="text-xs font-bold tabular-nums text-[var(--muted)]">Showing {shown.length} of {rows.length}</p>
      {hidden > 0 && (
        <button type="button" onClick={() => setPage({ of: compounds, sort, visible: visible + PAGE })} className="ink hard-sm press rounded-full bg-white px-5 py-2.5 text-sm font-bold">
          Show {Math.min(PAGE, hidden)} more
        </button>
      )}
    </div>
    </div>
  );
}

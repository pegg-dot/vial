"use client";
import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { Product } from "@/lib/types";
import type { LabTestRow } from "@/server/ingest/lab-tests";
import { ProductCard } from "@/components/product-card";
import { independentPurityByVendor, independentTestCountByVendor } from "@/lib/market-picks";
import { SORTS, sortListings, type CompoundSortKey } from "@/lib/compound-market-sort";

// The full market for ONE compound: every listing we hold, sorted the ways a buyer comparing a
// single peptide actually asks for. The compound page keeps the picks and the cheapest-first
// table; this is the room you walk into when those are not enough.
//
// The market-wide browser cannot serve this. It filters by SHELF (category), so it can never be
// scoped to a compound, and it sorts on evidence/price/rating — nothing about tested purity or
// real cost per active mg, which are the whole question when the compound is already chosen.

const PAGE = 24;

function Toggle({ on, onClick, children, count }: { on: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`ink-1 press inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold transition ${on ? "bg-[#111214] text-white" : "bg-white text-[#111214]"}`}
    >
      {children}
      {count !== undefined && <span className="tabular-nums opacity-60">{count}</span>}
    </button>
  );
}

export function CompoundMarket({ compoundName, listings, labTests }: { compoundName: string; listings: Product[]; labTests: LabTestRow[] }) {
  const [sort, setSort] = useState<CompoundSortKey>("cheapest");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [testedOnly, setTestedOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE);

  // The same maps the picks and the leaderboard read, so a purity shown here can never disagree
  // with the one shown on the compound page for the same vendor.
  const purity = useMemo(() => independentPurityByVendor(labTests), [labTests]);
  const tests = useMemo(() => independentTestCountByVendor(labTests), [labTests]);

  // Counted over ALL listings, never the filtered set, so a toggle's number cannot move because
  // of a different toggle the reader just touched.
  const inStockCount = useMemo(() => listings.filter((p) => p.availability !== "Unavailable").length, [listings]);
  const testedCount = useMemo(() => listings.filter((p) => (tests.get(p.vendorSlug) ?? 0) > 0).length, [listings, tests]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = listings.filter((p) => {
      if (inStockOnly && p.availability === "Unavailable") return false;
      if (testedOnly && (tests.get(p.vendorSlug) ?? 0) <= 0) return false;
      if (q && !`${p.name} ${p.vendorSlug.replace(/-/g, " ")} ${p.quantity}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return sortListings(filtered, sort, purity, tests);
  }, [listings, inStockOnly, testedOnly, query, sort, purity, tests]);

  const active = inStockOnly || testedOnly || query.trim() !== "";
  const shown = results.slice(0, visible);
  const activeSort = SORTS.find((s) => s.key === sort)!;

  // Every mutator re-pages from the top in the same render — leaving `visible` where it was would
  // show a reader the 40th match of a filter they just applied.
  const apply = (fn: () => void) => { fn(); setVisible(PAGE); };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => apply(() => setSort(s.key))}
            aria-pressed={sort === s.key}
            className={`ink-1 press rounded-full px-3.5 py-2 text-[13px] font-bold transition ${sort === s.key ? "bg-[#2b31d8] text-white" : "bg-white text-[#111214]"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[var(--muted)]">{activeSort.blurb}</p>

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <div className="ink-1 flex min-w-[14rem] flex-1 items-center gap-2.5 rounded-full bg-white px-4 py-2.5 focus-within:shadow-[3px_3px_0_#111214]">
          <SlidersHorizontal className="size-4 shrink-0 text-[var(--muted)]" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => apply(() => setQuery(e.target.value))}
            placeholder={`Search ${compoundName} listings by vendor or size`}
            aria-label={`Search ${compoundName} listings`}
            className="min-w-0 flex-1 bg-transparent text-[14px] font-medium outline-none placeholder:font-normal placeholder:text-[var(--muted)]"
          />
        </div>
        <Toggle on={inStockOnly} onClick={() => apply(() => setInStockOnly((v) => !v))} count={inStockCount}>In stock</Toggle>
        <Toggle on={testedOnly} onClick={() => apply(() => setTestedOnly((v) => !v))} count={testedCount}>Independently tested</Toggle>
        <p className="text-sm font-medium text-[var(--muted)]">
          <span data-testid="compound-market-count"><span className="font-extrabold text-black tabular-nums">{results.length}</span> listing{results.length === 1 ? "" : "s"}</span>
          {active && <span className="tabular-nums"> of {listings.length}</span>}
        </p>
        {active && (
          <button type="button" onClick={() => apply(() => { setInStockOnly(false); setTestedOnly(false); setQuery(""); })} className="ink-1 press rounded-full bg-white px-3.5 py-1.5 text-xs font-bold">
            Clear filters
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <div className="ink hard-sm mt-6 rounded-[16px] bg-white px-6 py-14 text-center">
          <p className="text-lg font-extrabold">No {compoundName} listing matches that.</p>
          <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-[var(--muted)]">
            We hold {listings.length} in total. Clearing the filters shows every one of them, including the vendors whose stock we last read as unavailable.
          </p>
          <button type="button" onClick={() => apply(() => { setInStockOnly(false); setTestedOnly(false); setQuery(""); })} className="ink hard-sm press mt-6 rounded-full bg-[#111214] px-5 py-2.5 text-sm font-bold text-white">Clear filters</button>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((p) => <ProductCard key={p.slug} product={p} />)}
          </div>
          {results.length > visible && (
            <div className="mt-8 flex flex-col items-center gap-2">
              <button onClick={() => setVisible((v) => v + PAGE)} className="ink hard press rounded-full bg-white px-6 py-3 text-sm font-bold">
                Show {Math.min(PAGE, results.length - visible)} more
              </button>
              <p className="text-xs font-medium tabular-nums text-[var(--muted)]">Showing {shown.length} of {results.length}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

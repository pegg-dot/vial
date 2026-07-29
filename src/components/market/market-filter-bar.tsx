"use client";
import { SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { SHELVES } from "@/lib/market-taxonomy";

export interface MarketFilters {
  query: string;
  shelf: string;
  tier: string;
  testedOnly: boolean;
  priceMax: number | null;
  availability: string;
  sort: string;
}

export const DEFAULT_FILTERS: MarketFilters = {
  query: "",
  shelf: "all",
  tier: "all",
  testedOnly: false,
  priceMax: null,
  availability: "all",
  sort: "evidence",
};

function Select({ value, onChange, label, children }: { value: string; onChange: (v: string) => void; label: string; children: React.ReactNode }) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="ink-1 min-h-12 w-full appearance-none rounded-xl bg-white px-4 pr-9 text-sm font-bold outline-none transition hover:-translate-y-0.5 lg:w-auto">
        {children}
      </select>
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-black/40">▼</span>
    </label>
  );
}

export function MarketFilterBar({ filters, onChange }: { filters: MarketFilters; onChange: (next: MarketFilters) => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const set = <K extends keyof MarketFilters>(key: K, value: MarketFilters[K]) => onChange({ ...filters, [key]: value });
  const activeCount = [filters.shelf !== "all", filters.tier !== "all", filters.availability !== "all", filters.testedOnly, filters.priceMax != null].filter(Boolean).length;

  return (
    <div className="ink hard mb-6 flex flex-col gap-3 rounded-[18px] bg-white p-3 lg:flex-row lg:flex-wrap lg:items-center">
      <label className="ink-1 flex min-h-12 flex-1 items-center gap-3 rounded-xl bg-[var(--background)] px-4">
        <span className="text-sm font-bold text-[var(--muted)]">Search</span>
        <input value={filters.query} onChange={(e) => set("query", e.target.value)} placeholder="Compound, vendor, or quantity" className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:font-normal placeholder:text-black/30" />
        {filters.query && (
          <button onClick={() => set("query", "")} aria-label="Clear search" className="rounded-full p-1 text-[var(--muted)] hover:bg-black/[.05]">
            <X className="size-3.5" />
          </button>
        )}
      </label>

      <button onClick={() => setMobileOpen((v) => !v)} className="ink-1 flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold lg:hidden" aria-expanded={mobileOpen}>
        <SlidersHorizontal className="size-4" /> Filters {activeCount > 0 && <span className="rounded-full bg-black px-2 py-0.5 text-[10px] text-white">{activeCount}</span>}
      </button>

      <div className={`${mobileOpen ? "grid" : "hidden"} gap-3 lg:flex lg:flex-wrap lg:items-center`}>
        <Select value={filters.shelf} onChange={(v) => set("shelf", v)} label="Category">
          <option value="all">All categories</option>
          {SHELVES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </Select>
        <Select value={filters.tier} onChange={(v) => set("tier", v)} label="Verification">
          <option value="all">Any verification</option>
          <option value="independent">Independently tested</option>
          <option value="vendor">Vendor-tested only</option>
          <option value="none">No tests on record</option>
        </Select>
        <Select value={filters.priceMax == null ? "all" : String(filters.priceMax)} onChange={(v) => set("priceMax", v === "all" ? null : Number(v))} label="Max price">
          <option value="all">Any price</option>
          <option value="50">Under $50</option>
          <option value="100">Under $100</option>
          <option value="200">Under $200</option>
        </Select>
        <Select value={filters.availability} onChange={(v) => set("availability", v)} label="Availability">
          <option value="all">Any availability</option>
          <option value="In stock">In stock</option>
          <option value="Low stock">Low stock</option>
          <option value="Unavailable">Unavailable</option>
        </Select>
        <Select value={filters.sort} onChange={(v) => set("sort", v)} label="Sort">
          <option value="evidence">Strongest evidence</option>
          <option value="value">Best value ($/mg)</option>
          <option value="price-low">Price: low to high</option>
          <option value="price-high">Price: high to low</option>
          <option value="rating">Highest rating</option>
          <option value="fresh">Recently checked</option>
        </Select>
        <button
          type="button"
          onClick={() => set("testedOnly", !filters.testedOnly)}
          aria-pressed={filters.testedOnly}
          className={`ink-1 inline-flex min-h-12 items-center gap-2 rounded-xl px-4 text-sm font-bold transition ${filters.testedOnly ? "bg-[#111214] text-white" : "bg-white"}`}
        >
          Tested only
        </button>
      </div>
    </div>
  );
}

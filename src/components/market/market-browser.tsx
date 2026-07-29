"use client";
import { useMemo, useState } from "react";
import type { EvidenceLevel } from "@/lib/types";
import { ProductCard } from "@/components/product-card";
import { useMarketplace } from "@/components/marketplace-state";
import { shelfForCompound } from "@/lib/market-taxonomy";
import { compoundTrustTier } from "@/lib/curation";
import { MarketFilterBar, type MarketFilters } from "./market-filter-bar";

const EVIDENCE_RANK: Record<EvidenceLevel, number> = { independent: 5, "issuer-confirmed": 4, "vendor-published": 3, stale: 2, "public-only": 1 };

type LocalFilters = Omit<MarketFilters, "shelf">;
const DEFAULT_LOCAL: LocalFilters = { query: "", tier: "all", testedOnly: false, priceMax: null, availability: "all", sort: "evidence" };
const withoutShelf = (f: MarketFilters): LocalFilters => ({ query: f.query, tier: f.tier, testedOnly: f.testedOnly, priceMax: f.priceMax, availability: f.availability, sort: f.sort });

// The exhaustive, faceted "browse everything" grid — the bottom of the market page.
// Filters listings by shelf, verification tier, price, availability, and search; sorts by
// evidence, real value ($/mg), price, rating, or freshness.
export function MarketBrowser({ shelf, onShelfChange }: { shelf: string; onShelfChange: (shelf: string) => void }) {
  const { catalog } = useMarketplace();
  const { compounds, products, vendors } = catalog;

  // Shelf is controlled by the parent (shared with the category rail) so the rail highlight
  // and the grid stay in sync; the other facets stay local and survive a rail click. Shelf
  // is composed from the prop, never mirrored into state.
  const [local, setLocal] = useState<LocalFilters>(DEFAULT_LOCAL);
  const filters = useMemo<MarketFilters>(() => ({ ...local, shelf }), [local, shelf]);
  const handleChange = (next: MarketFilters) => {
    if (next.shelf !== shelf) onShelfChange(next.shelf);
    setLocal(withoutShelf(next));
  };

  const compoundBySlug = useMemo(() => new Map(compounds.map((c) => [c.slug, c])), [compounds]);
  const vendorBySlug = useMemo(() => new Map(vendors.map((v) => [v.slug, v])), [vendors]);

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const next = products.filter((product) => {
      const compound = compoundBySlug.get(product.compoundSlug);
      const vendor = vendorBySlug.get(product.vendorSlug);
      if (q && !`${product.name} ${product.quantity} ${vendor?.name ?? ""}`.toLowerCase().includes(q)) return false;
      if (filters.shelf !== "all" && (!compound || shelfForCompound(compound).key !== filters.shelf)) return false;
      if (filters.tier !== "all" && (!compound || compoundTrustTier(compound).tier !== filters.tier)) return false;
      if (filters.testedOnly && (!compound || compound.coaCount <= 0)) return false;
      if (filters.priceMax != null && product.price > filters.priceMax) return false;
      if (filters.availability !== "all" && product.availability !== filters.availability) return false;
      return true;
    });
    return [...next].sort((a, b) => {
      switch (filters.sort) {
        case "price-low": return a.price - b.price;
        case "price-high": return b.price - a.price;
        case "rating": return b.rating - a.rating;
        case "fresh": return b.lastChecked.localeCompare(a.lastChecked);
        case "value": {
          const av = a.pricePerMg ?? Infinity, bv = b.pricePerMg ?? Infinity;
          return av - bv;
        }
        default: return EVIDENCE_RANK[b.evidenceLevel] - EVIDENCE_RANK[a.evidenceLevel] || b.rating - a.rating;
      }
    });
  }, [products, filters, compoundBySlug, vendorBySlug]);

  const hasFilters = filters.query !== "" || filters.shelf !== "all" || filters.tier !== "all" || filters.availability !== "all" || filters.testedOnly || filters.priceMax != null;
  const reset = () => { setLocal(DEFAULT_LOCAL); onShelfChange("all"); };

  return (
    <div>
      <MarketFilterBar filters={filters} onChange={handleChange} />
      <div className="mb-6 flex items-center justify-between gap-4">
        <p data-testid="market-count" className="text-sm font-medium text-[var(--muted)]">
          <span className="font-extrabold text-black">{filtered.length}</span> listings
        </p>
        {hasFilters && <button onClick={reset} className="text-sm font-bold text-black/60 hover:text-black">Reset filters</button>}
      </div>
      {filtered.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((product) => <ProductCard key={product.slug} product={product} />)}
        </div>
      ) : (
        <div className="ink rounded-[20px] bg-white px-6 py-20 text-center">
          <p className="text-xl font-extrabold tracking-[-0.03em]">No listings match these filters</p>
          <p className="mt-2 text-sm font-medium text-[var(--muted)]">Reset the filters or search for a different compound.</p>
          <button onClick={reset} className="ink hard press mt-6 rounded-full bg-[#2b31d8] px-5 py-3 text-sm font-bold text-white">Reset market</button>
        </div>
      )}
    </div>
  );
}

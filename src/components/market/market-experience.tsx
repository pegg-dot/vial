"use client";
import { useMemo, useRef, useState } from "react";
import type { Compound } from "@/lib/types";
import { useMarketplace } from "@/components/marketplace-state";
import { ProductCard } from "@/components/product-card";
import { trending, mostVerified, bestValue, newest } from "@/lib/curation";
import { STACKS, resolveStack, type ResolvedStack } from "@/lib/stacks";
import { CategoryRail } from "./category-rail";
import { CollectionRow } from "./collection-row";
import { CompoundTickerCard } from "./compound-ticker-card";
import { StackCard } from "./stack-card";
import { MarketBrowser } from "./market-browser";
import { QuickViewModal } from "./quick-view-modal";

// The market storefront: category rail → curated rows (each tile carries its row's own
// ranking metric) → stacks → the faceted browse grid, with quick-view over compound rows.
export function MarketExperience() {
  const { catalog } = useMarketplace();
  const { compounds, products } = catalog;
  const [qv, setQv] = useState<{ items: Compound[]; index: number | null }>({ items: [], index: null });
  const [browseShelf, setBrowseShelf] = useState<string>("all");
  const browseRef = useRef<HTMLDivElement>(null);

  const trend = useMemo(() => trending(compounds, 10), [compounds]);
  const verified = useMemo(() => mostVerified(compounds, 10), [compounds]);
  const value = useMemo(() => bestValue(products, 8), [products]);
  const fresh = useMemo(() => newest(products.filter((p) => p.origin === "live"), 8), [products]);
  const stacks = useMemo(
    () => STACKS.map((s) => resolveStack(s, compounds)).filter((r): r is ResolvedStack => r !== null),
    [compounds],
  );

  const openRow = (items: Compound[], index: number) => setQv({ items, index });

  const selectShelf = (key: string | null) => {
    setBrowseShelf(key ?? "all");
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    browseRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <div>
      <CategoryRail activeKey={browseShelf === "all" ? null : browseShelf} onSelect={selectShelf} />

      {trend.length > 0 && (
        <CollectionRow eyebrow="Most looked-up" title="Trending now" blurb="What buyers are researching most across the market right now.">
          {trend.map((c, i) => (
            <div key={c.slug} className="w-[280px] shrink-0 snap-start">
              <CompoundTickerCard compound={c} products={products} metric={{ label: "listings", value: String(c.listings) }} onQuickView={() => openRow(trend, i)} />
            </div>
          ))}
        </CollectionRow>
      )}

      {verified.length > 0 && (
        <CollectionRow eyebrow="Most independent evidence" title="Independently verified" blurb="Compounds with the most third-party lab certificates on record — the strongest evidence a batch was real.">
          {verified.map((c, i) => (
            <div key={c.slug} className="w-[280px] shrink-0 snap-start">
              <CompoundTickerCard compound={c} products={products} metric={{ label: "lab tests", value: String(c.coaCount) }} onQuickView={() => openRow(verified, i)} />
            </div>
          ))}
        </CollectionRow>
      )}

      {value.length > 0 && (
        <CollectionRow eyebrow="Cheapest real cost" title="Lowest cost per mg" blurb="Ranked by what a milligram actually costs. Suspiciously-cheap listings are flagged, not hidden.">
          {value.map((p) => (
            <div key={p.slug} className="w-[300px] shrink-0 snap-start">
              <ProductCard product={p} />
            </div>
          ))}
        </CollectionRow>
      )}

      {stacks.length > 0 && (
        <CollectionRow eyebrow="Commonly discussed" title="Stacks & blends" blurb="Combinations the research community talks about — a blend is one pre-mixed vial; a recipe is compounds bought separately. Not a protocol.">
          {stacks.map((r) => <StackCard key={r.stack.slug} resolved={r} />)}
        </CollectionRow>
      )}

      {fresh.length > 0 && (
        <CollectionRow eyebrow="Just added" title="New on VIAL" blurb="The most recently checked live listings — the market history that keeps growing.">
          {fresh.map((p) => (
            <div key={p.slug} className="w-[300px] shrink-0 snap-start">
              <ProductCard product={p} />
            </div>
          ))}
        </CollectionRow>
      )}

      <div ref={browseRef} className="scroll-mt-24 pt-8">
        <div className="mb-6">
          <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#0e8f80]">Every listing</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-[-.045em]">Browse everything</h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[var(--muted)]">Filter the whole market by category, verification, price, and availability.</p>
        </div>
        <MarketBrowser shelf={browseShelf} onShelfChange={setBrowseShelf} />
      </div>

      <QuickViewModal
        items={qv.items}
        index={qv.index}
        products={products}
        onClose={() => setQv({ items: [], index: null })}
        onNavigate={(next) => setQv((s) => ({ ...s, index: next }))}
      />
    </div>
  );
}

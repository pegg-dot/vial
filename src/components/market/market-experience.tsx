"use client";
import { useMemo, useRef, useState } from "react";
import type { CatalogSnapshot, Compound } from "@/lib/types";
import { ProductCard } from "@/components/product-card";
import { trending, mostVerified, bestValue, newest, hasIndependentEvidence, hasPerMgPrice } from "@/lib/curation";
import { countListingsByShelf } from "@/lib/market-taxonomy";
import { STACKS, resolveStack, type ResolvedStack } from "@/lib/stacks";
import { CategoryRail } from "./category-rail";
import { CollectionRow } from "./collection-row";
import { CompoundTickerCard } from "./compound-ticker-card";
import { StackCard } from "./stack-card";
import { MarketBrowser } from "./market-browser";
import { QuickViewModal } from "./quick-view-modal";

// The market storefront: category rail → curated rows (each tile carries its row's own
// ranking metric) → stacks → the faceted browse grid, with quick-view over compound rows.
//
// The catalog arrives as a prop from the /market server component, NOT from useMarketplace().
// This surface reads whole listings — price histories for the sparklines, evidence levels for the
// ranking, trust verdicts for the cards — and the provider now carries only the lite projection
// the site-wide chrome needs. Taking it as a prop keeps those bytes on the one page that renders
// them instead of on all ~830.
export function MarketExperience({ catalog }: { catalog: CatalogSnapshot }) {
  const { compounds, products } = catalog;
  const [qv, setQv] = useState<{ items: Compound[]; index: number | null }>({ items: [], index: null });
  const [browseShelf, setBrowseShelf] = useState<string>("all");
  const browseRef = useRef<HTMLDivElement>(null);

  const trend = useMemo(() => trending(compounds, 10), [compounds]);
  // Counted in listings, not compounds, because that is what the rail scrolls you to.
  const shelfCounts = useMemo(() => countListingsByShelf(compounds, products), [compounds, products]);
  const verified = useMemo(() => mostVerified(compounds, 10), [compounds]);
  const value = useMemo(() => bestValue(products, 8), [products]);
  const live = useMemo(() => products.filter((p) => p.origin === "live"), [products]);
  const fresh = useMemo(() => newest(live, 8), [live]);

  // What each row is a top OF. Counted from the same predicates the ranking uses (exported from
  // curation.ts), never from a second filter written here, so the denominator cannot drift away
  // from the set the row is actually drawn from. Rows below say this out loud: a top-8 rendered as
  // if it were the whole market is a claim about the market that isn't true.
  const verifiedTotal = useMemo(() => compounds.filter(hasIndependentEvidence).length, [compounds]);
  const valueTotal = useMemo(() => products.filter(hasPerMgPrice).length, [products]);
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
      <CategoryRail counts={shelfCounts} activeKey={browseShelf === "all" ? null : browseShelf} onSelect={selectShelf} />

      {trend.length > 0 && (
        <CollectionRow eyebrow="Most looked-up" title="Trending now" blurb="What buyers are researching most across the market right now." extent={{ shown: trend.length, total: compounds.length, noun: "compounds we track" }} seeAllHref="/compounds" seeAllLabel="All compounds">
          {trend.map((c, i) => (
            <div key={c.slug} className="w-[280px] shrink-0 snap-start">
              <CompoundTickerCard compound={c} products={products} metric={{ label: "listings", value: String(c.listings) }} onQuickView={() => openRow(trend, i)} />
            </div>
          ))}
        </CollectionRow>
      )}

      {verified.length > 0 && (
        <CollectionRow eyebrow="Most independent evidence" title="Independently verified" blurb="Compounds with the most third-party lab certificates on record — the strongest evidence a batch was real." extent={{ shown: verified.length, total: verifiedTotal, noun: "compounds with an independent certificate on record" }} seeAllHref="/compounds" seeAllLabel="All compounds">
          {verified.map((c, i) => (
            <div key={c.slug} className="w-[280px] shrink-0 snap-start">
              <CompoundTickerCard compound={c} products={products} metric={{ label: "lab tests", value: String(c.coaCount) }} onQuickView={() => openRow(verified, i)} />
            </div>
          ))}
        </CollectionRow>
      )}

      {value.length > 0 && (
        <CollectionRow eyebrow="Cheapest real cost" title="Lowest cost per mg" blurb="Ranked by what a milligram actually costs. Suspiciously-cheap listings are flagged, not hidden." extent={{ shown: value.length, total: valueTotal, noun: "listings we can price per mg" }} seeAllHref="/market#browse" seeAllLabel="Browse every listing">
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
        <CollectionRow eyebrow="Just added" title="New on VialGrade" blurb="The most recently checked live listings — the market history that keeps growing." extent={{ shown: fresh.length, total: live.length, noun: "live listings" }} seeAllHref="/market#browse" seeAllLabel="Browse every listing">
          {fresh.map((p) => (
            <div key={p.slug} className="w-[300px] shrink-0 snap-start">
              <ProductCard product={p} />
            </div>
          ))}
        </CollectionRow>
      )}

      <div id="browse" ref={browseRef} className="scroll-mt-24 pt-8">
        <div className="mb-6">
          <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#0e8f80]">Every listing</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-[-.045em]">Browse everything</h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[var(--muted)]">Filter the whole market by category, verification, price, and availability.</p>
        </div>
        <MarketBrowser catalog={catalog} shelf={browseShelf} onShelfChange={setBrowseShelf} />
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

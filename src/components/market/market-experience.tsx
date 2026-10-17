"use client";
import { useMemo, useRef, useState } from "react";
import type { CatalogSnapshot, Compound } from "@/lib/types";
import { ProductCard } from "@/components/product-card";
import { trending, mostVerified, newest, hasIndependentEvidence } from "@/lib/curation";
import { countListingsByShelf } from "@/lib/market-taxonomy";
import { CategoryRail } from "./category-rail";
import { CollectionRow } from "./collection-row";
import { CompoundTickerCard } from "./compound-ticker-card";
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
  const live = useMemo(() => products.filter((p) => p.origin === "live"), [products]);
  const fresh = useMemo(() => newest(live, 8), [live]);

  // What each row is a top OF. Counted from the same predicates the ranking uses (exported from
  // curation.ts), never from a second filter written here, so the denominator cannot drift away
  // from the set the row is actually drawn from. Rows below say this out loud: a top-8 rendered as
  // if it were the whole market is a claim about the market that isn't true.
  const verifiedTotal = useMemo(() => compounds.filter(hasIndependentEvidence).length, [compounds]);

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
        <CollectionRow eyebrow="Most looked-up" title="Trending now" blurb="What has the most recorded marketplace observations. Not a measure of scientific quality or clinical benefit." extent={{ shown: trend.length, total: compounds.length, noun: "compounds we track" }} seeAllHref="/compounds" seeAllLabel="All compounds">
          {trend.map((c, i) => (
            <div key={c.slug} className="w-[248px] shrink-0 snap-start">
              <CompoundTickerCard compound={c} products={products} metric={{ label: "listings", value: String(c.listings) }} onQuickView={() => openRow(trend, i)} />
            </div>
          ))}
        </CollectionRow>
      )}

      {verified.length > 0 && (
        <CollectionRow eyebrow="Most independent evidence" title="Most lab reports on record" blurb="Compounds with the largest number of recorded lab reports. A report applies only to the sampled material and does not authenticate a later shipment." extent={{ shown: verified.length, total: verifiedTotal, noun: "compounds with an independent certificate on record" }} seeAllHref="/compounds" seeAllLabel="All compounds">
          {verified.map((c, i) => (
            <div key={c.slug} className="w-[248px] shrink-0 snap-start">
              <CompoundTickerCard compound={c} products={products} metric={{ label: "lab tests", value: String(c.coaCount) }} onQuickView={() => openRow(verified, i)} />
            </div>
          ))}
        </CollectionRow>
      )}

      {fresh.length > 0 && (
        <CollectionRow eyebrow="Just added" title="New on VialGrade" blurb="The most recently checked live listings — the market history that keeps growing." extent={{ shown: fresh.length, total: live.length, noun: "live listings" }} seeAllHref="/market#browse" seeAllLabel="Browse every listing">
          {fresh.map((p) => (
            <div key={p.slug} className="w-[248px] shrink-0 snap-start">
              <ProductCard product={p} />
            </div>
          ))}
        </CollectionRow>
      )}

      <div id="browse" ref={browseRef} className="scroll-mt-24 pt-4">
        <div className="mb-4">
          <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#0e8f80]">Every listing</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-[-.045em]">Browse everything</h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[var(--muted)]">Filter historical observations by category, documentation, price and recorded availability. Listings are not purchase recommendations.</p>
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

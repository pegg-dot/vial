"use client";
import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, Table2 } from "lucide-react";
import type { CatalogSnapshot, Compound } from "@/lib/types";
import { trending } from "@/lib/curation";
import { groupByShelf } from "@/lib/market-taxonomy";
import { STACKS, resolveStack, type ResolvedStack } from "@/lib/stacks";
import { CollectionRow } from "./collection-row";
import { CompoundTickerCard } from "./compound-ticker-card";
import { StackCard } from "./stack-card";
import { CompoundMarketTable } from "./compound-market-table";
import { QuickViewModal } from "./quick-view-modal";

// The compound directory — VialGrade's "terminal". A ranked market table (default) or
// category shelves, plus a trending strip and stacks, all with quick-view.
// The catalog arrives as a prop from the /compounds server component rather than from
// useMarketplace(): the market table and quick-view read whole records (price histories, purity,
// research notes), and the provider carries only the lite projection the site chrome needs.
export function CompoundsExperience({ catalog, initialShelf = null }: { catalog: CatalogSnapshot; initialShelf?: string | null }) {
  const { compounds, products } = catalog;
  const [view, setView] = useState<"terminal" | "shelves">(initialShelf ? "shelves" : "terminal");
  const [qv, setQv] = useState<{ items: Compound[]; index: number | null }>({ items: [], index: null });

  const trend = useMemo(() => trending(compounds, 10), [compounds]);
  const groups = useMemo(() => groupByShelf(compounds), [compounds]);
  const stacks = useMemo(
    () => STACKS.map((s) => resolveStack(s, compounds)).filter((r): r is ResolvedStack => r !== null),
    [compounds],
  );
  const openRow = (items: Compound[], index: number) => setQv({ items, index });

  // A ?shelf= deep-link opens the shelves view scrolled to that category section.
  useEffect(() => {
    if (!initialShelf || view !== "shelves") return;
    const el = document.getElementById(`shelf-${initialShelf}`);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [initialShelf, view]);

  return (
    <div>
      {trend.length > 0 && (
        <CollectionRow eyebrow="Most looked-up" title="Trending compounds" blurb="The compounds buyers are researching most right now.">
          {trend.map((c, i) => (
            <div key={c.slug} className="w-[280px] shrink-0 snap-start">
              <CompoundTickerCard compound={c} products={products} metric={{ label: "vendors", value: String(c.listings) }} onQuickView={() => openRow(trend, i)} />
            </div>
          ))}
        </CollectionRow>
      )}

      <div className="flex items-center justify-between gap-4 pt-6">
        <h2 className="text-3xl font-extrabold tracking-[-.045em]">Every compound</h2>
        <div className="ink-1 inline-flex gap-1 rounded-full bg-white p-1">
          <button type="button" onClick={() => setView("terminal")} aria-pressed={view === "terminal"} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition ${view === "terminal" ? "bg-[#111214] text-white" : "text-[var(--muted)]"}`}>
            <Table2 className="size-3.5" /> Terminal
          </button>
          <button type="button" onClick={() => setView("shelves")} aria-pressed={view === "shelves"} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition ${view === "shelves" ? "bg-[#111214] text-white" : "text-[var(--muted)]"}`}>
            <LayoutGrid className="size-3.5" /> Shelves
          </button>
        </div>
      </div>

      {view === "terminal" ? (
        <div className="mt-6">
          <CompoundMarketTable compounds={compounds} products={products} onOpen={openRow} />
        </div>
      ) : (
        <div className="mt-6 space-y-12">
          {groups.map(({ shelf, compounds: shelfCompounds }) => (
            <section key={shelf.key} id={`shelf-${shelf.key}`} className="scroll-mt-24">
              <div className="mb-5">
                <h3 className="text-2xl font-extrabold tracking-[-.03em]">{shelf.label}</h3>
                <p className="mt-1 text-sm font-medium text-[var(--muted)]">{shelf.blurb}</p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {shelfCompounds.map((c, i) => (
                  <CompoundTickerCard key={c.slug} compound={c} products={products} onQuickView={() => openRow(shelfCompounds, i)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {stacks.length > 0 && (
        <CollectionRow eyebrow="Commonly discussed" title="Popular stacks" blurb="Combinations the research community talks about — not a protocol.">
          {stacks.map((r) => <StackCard key={r.stack.slug} resolved={r} />)}
        </CollectionRow>
      )}

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

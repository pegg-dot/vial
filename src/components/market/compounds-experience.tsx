"use client";
import { useMemo, useState } from "react";
import { LayoutGrid, Search, Table2, X } from "lucide-react";
import type { CatalogSnapshot, Compound } from "@/lib/types";
import { trending } from "@/lib/curation";
import { groupByShelf } from "@/lib/market-taxonomy";
import { CategoryRail } from "./category-rail";
import { STACKS, resolveStack, type ResolvedStack } from "@/lib/stacks";
import { CollectionRow } from "./collection-row";
import { CompoundTickerCard } from "./compound-ticker-card";
import { StackCard } from "./stack-card";
import { CompoundMarketTable } from "./compound-market-table";
import { QuickViewModal } from "./quick-view-modal";

// Everything a buyer could arrive already knowing: the catalog name, the shorthand printed on the
// vial, the older/street names in `aliases`, and the category. Matching `name` alone would tell
// someone who typed "body protection compound" or "metabolic" that we track nothing of the sort.
function matchesQuery(compound: Compound, needle: string): boolean {
  return [compound.name, compound.shorthand, compound.category, ...compound.aliases].join(" ").toLowerCase().includes(needle);
}

// The compound directory. Category shelves (default) or the ranked market table ("terminal"),
// plus a trending strip and stacks, all with quick-view.
//
// Shelves first, and eight per shelf: the shelves view rendered every compound of every category
// in one scroll, so a reader after "Cognitive & Mood" — the fifth shelf — scrolled past forty
// tiles to reach it. Now a shelf shows two rows and offers the rest, and the rail above filters
// straight to one shelf. The table paginates the same way: fifteen rows, then more on request.
const SHELF_PAGE = 8;
// The catalog arrives as a prop from the /compounds server component rather than from
// useMarketplace(): the market table and quick-view read whole records (price histories, purity,
// research notes), and the provider carries only the lite projection the site chrome needs.
export function CompoundsExperience({ catalog, initialShelf = null }: { catalog: CatalogSnapshot; initialShelf?: string | null }) {
  const { compounds, products } = catalog;
  const [view, setView] = useState<"terminal" | "shelves">("shelves");
  // The rail's filter. A ?shelf= deep-link lands filtered rather than scrolled — the section it used
  // to scroll to now sits behind seven others' "show more" buttons, which scrolling cannot honour.
  const [activeShelf, setActiveShelf] = useState<string | null>(initialShelf);
  const [expandedShelves, setExpandedShelves] = useState<ReadonlySet<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [qv, setQv] = useState<{ items: Compound[]; index: number | null }>({ items: [], index: null });

  const trend = useMemo(() => trending(compounds, 10), [compounds]);

  // Both views render the whole catalog at once with no pagination, so until now a buyer who
  // arrived knowing a compound name had no control to type it into — only ctrl-F over ~40 rows.
  // Trending and stacks stay on the full catalog: they are curation, not the directory.
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? compounds.filter((c) => matchesQuery(c, needle)) : compounds;
  }, [compounds, query]);

  // How many DISTINCT vendors sell each compound.
  //
  // These cards previously rendered `c.listings` under the label "vendors", which is a different
  // relationship entirely: BPC-157 has 39 listings but only 14 vendors selling it, so the card
  // claimed nearly three times the real number. On a site whose whole premise is that other
  // people's numbers do not survive checking, publishing one that does not survive checking is the
  // worst kind of bug. Counted from the listings themselves so it cannot drift from them.
  const vendorsPerCompound = useMemo(() => {
    const seen = new Map<string, Set<string>>();
    for (const p of products) {
      const set = seen.get(p.compoundSlug);
      if (set) set.add(p.vendorSlug);
      else seen.set(p.compoundSlug, new Set([p.vendorSlug]));
    }
    return seen;
  }, [products]);
  const vendorCount = (slug: string) => String(vendorsPerCompound.get(slug)?.size ?? 0);
  const groups = useMemo(() => groupByShelf(results), [results]);
  // Compounds per shelf over the WHOLE directory, so the rail's numbers are what selecting a pill
  // shows before any search narrows it — the same denominator the count line uses.
  const shelfCounts = useMemo(() => new Map(groupByShelf(compounds).map((g) => [g.shelf.key, g.compounds.length])), [compounds]);
  const visibleGroups = useMemo(() => (activeShelf ? groups.filter((g) => g.shelf.key === activeShelf) : groups), [groups, activeShelf]);
  const expandShelf = (key: string) => setExpandedShelves((prev) => new Set(prev).add(key));
  const stacks = useMemo(
    () => STACKS.map((s) => resolveStack(s, compounds)).filter((r): r is ResolvedStack => r !== null),
    [compounds],
  );
  const openRow = (items: Compound[], index: number) => setQv({ items, index });

  return (
    <div>
      {trend.length > 0 && (
        <CollectionRow eyebrow="Most looked-up" title="Trending compounds" blurb="The compounds buyers are researching most right now." extent={{ shown: trend.length, total: compounds.length, noun: "compounds we track" }}>
          {trend.map((c, i) => (
            <div key={c.slug} className="w-[248px] shrink-0 snap-start">
              <CompoundTickerCard compound={c} products={products} metric={{ label: "vendors", value: vendorCount(c.slug) }} onQuickView={() => openRow(trend, i)} />
            </div>
          ))}
        </CollectionRow>
      )}

      <div className="flex items-center justify-between gap-4 pt-6">
        <h2 className="text-3xl font-extrabold tracking-[-.045em]">Every compound</h2>
        <div className="ink-1 inline-flex gap-1 rounded-full bg-white p-1">
          <button type="button" onClick={() => setView("shelves")} aria-pressed={view === "shelves"} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition ${view === "shelves" ? "bg-[#111214] text-white" : "text-[var(--muted)]"}`}>
            <LayoutGrid className="size-3.5" /> Shelves
          </button>
          <button type="button" onClick={() => setView("terminal")} aria-pressed={view === "terminal"} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition ${view === "terminal" ? "bg-[#111214] text-white" : "text-[var(--muted)]"}`}>
            <Table2 className="size-3.5" /> Terminal
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-[14px] border-[1.5px] border-[#111214] bg-white px-4 py-3 transition focus-within:shadow-[3px_3px_0_#2b31d8] sm:max-w-[420px]">
          <Search className="size-4 shrink-0 text-[var(--muted)]" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a compound, shorthand, or category"
            aria-label="Search compounds"
            className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:font-normal placeholder:text-[var(--muted)]"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="ink-1 rounded-full bg-white p-1.5 text-[var(--muted)] transition hover:text-[#111214]">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <p className="text-sm font-bold tabular-nums" data-testid="compound-count">
          {results.length} {results.length === 1 ? "compound" : "compounds"}
          {results.length !== compounds.length && <span className="font-medium text-[var(--muted)]"> of {compounds.length}</span>}
        </p>
      </div>

      {view === "shelves" && (
        <div className="mt-4">
          <CategoryRail counts={shelfCounts} activeKey={activeShelf} onSelect={setActiveShelf} />
        </div>
      )}

      {results.length === 0 || (view === "shelves" && visibleGroups.length === 0) ? (
        /* Without this the table rendered its header over an empty tbody and the shelves view
           collapsed to nothing — a search that missed looked like the directory had broken. */
        <div className="ink mt-6 rounded-[20px] bg-white px-6 py-20 text-center">
          <p className="text-xl font-extrabold tracking-[-0.03em]">
            {results.length === 0 ? <>No compounds match “{query.trim()}”</> : <>Nothing on this shelf matches “{query.trim()}”</>}
          </p>
          <p className="mt-2 text-sm font-medium text-[var(--muted)]">Try the shorthand printed on the vial, an older name, or a category.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {query && <button type="button" onClick={() => setQuery("")} className="ink hard press rounded-full bg-[#2b31d8] px-5 py-3 text-sm font-bold text-white">Clear search</button>}
            {activeShelf && <button type="button" onClick={() => setActiveShelf(null)} className="ink hard-sm press rounded-full bg-white px-5 py-3 text-sm font-bold">All shelves</button>}
          </div>
        </div>
      ) : view === "terminal" ? (
        <div className="mt-6">
          <CompoundMarketTable compounds={results} products={products} onOpen={openRow} />
        </div>
      ) : (
        <div className="mt-6 space-y-10">
          {visibleGroups.map(({ shelf, compounds: shelfCompounds }) => {
            // A filtered shelf is the reader asking for that shelf: show all of it. Unfiltered, two
            // rows and an honest count of what is behind the button.
            const expanded = activeShelf === shelf.key || expandedShelves.has(shelf.key);
            const shown = expanded ? shelfCompounds : shelfCompounds.slice(0, SHELF_PAGE);
            const hidden = shelfCompounds.length - shown.length;
            return (
              <section key={shelf.key} id={`shelf-${shelf.key}`} className="scroll-mt-24">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-extrabold tracking-[-.03em]">{shelf.label}</h3>
                    <p className="mt-1 text-sm font-medium text-[var(--muted)]">{shelf.blurb}</p>
                  </div>
                  <p className="text-xs font-bold tabular-nums text-[var(--muted)]">
                    {hidden > 0 ? <>Showing {shown.length} of {shelfCompounds.length}</> : <>{shelfCompounds.length} compound{shelfCompounds.length === 1 ? "" : "s"}</>}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {shown.map((c, i) => (
                    <CompoundTickerCard key={c.slug} compound={c} products={products} onQuickView={() => openRow(shown, i)} />
                  ))}
                </div>
                {hidden > 0 && (
                  <div className="mt-4 flex justify-center">
                    <button type="button" onClick={() => expandShelf(shelf.key)} className="ink hard-sm press rounded-full bg-white px-5 py-2.5 text-sm font-bold">
                      Show {hidden} more {shelf.label.toLowerCase()}
                    </button>
                  </div>
                )}
              </section>
            );
          })}
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
